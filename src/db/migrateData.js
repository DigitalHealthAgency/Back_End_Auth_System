// Load environment variables from .env file
require('dotenv').config();

const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// --- Configuration ---

// MongoDB Connection
const MONGODB_URI = process.env.MONGO_URI;
const MONGODB_DB_NAME = new URL(MONGODB_URI).pathname.substring(1); // Extract database name from URI

// PostgreSQL Connection (Aiven Credentials)
const POSTGRES_CONFIG = {
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    host: process.env.PG_HOST,
    port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
    database: process.env.PG_DATABASE,
    ssl: {
        rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true,
        ca: process.env.PG_SSL_CA,
    },
};

const BATCH_SIZE = 1000; // Number of documents to fetch/insert in one batch

// --- Database Clients ---
let mongoClient;
let pgPool;

// --- Utility Functions ---

/**
 * Connects to MongoDB.
 * @returns {Promise<MongoClient>} The connected MongoDB client.
 */
async function connectMongoDB() {
    try {
        //console.log(`[MongoDB] Attempting to connect to ${MONGODB_URI}...`);
        mongoClient = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });
        await mongoClient.connect();
        //console.log(`[MongoDB] Connected successfully to ${MONGODB_DB_NAME}.`);
        return mongoClient;
    } catch (error) {
        console.error(`[MongoDB] Connection error: ${error.message}`);
        throw error;
    }
}

/**
 * Connects to PostgreSQL.
 * @returns {Promise<Pool>} The connected PostgreSQL pool.
 */
async function connectPostgreSQL() {
    try {
        //console.log(`[PostgreSQL] Attempting to connect to ${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}/${POSTGRES_CONFIG.database}...`);
        pgPool = new Pool(POSTGRES_CONFIG);
        // Test connection
        await pgPool.query('SELECT NOW()');
        console.log(`[PostgreSQL] Connected successfully to ${POSTGRES_CONFIG.database}.`);
        return pgPool;
    } catch (error) {
        console.error(`[PostgreSQL] Connection error: ${error.message}`);
        throw error;
    }
}

/**
 * Ensures a PostgreSQL table exists with the necessary schema.
 * Uses ON CONFLICT to allow upserting.
 * @param {Pool} pool - The PostgreSQL connection pool.
 * @param {string} tableName - The name of the table to create/ensure.
 * @param {object} schema - An object defining column names and their types.
 * e.g., { mongo_id: 'TEXT UNIQUE', email: 'TEXT', data: 'JSONB' }
 * @param {string} primaryKeyConflictColumn - The column to use for ON CONFLICT clause (e.g., 'mongo_id').
 */
async function ensurePostgreSQLTable(pool, tableName, schema, primaryKeyConflictColumn) {
    const columns = Object.entries(schema).map(([colName, colType]) => `${colName} ${colType}`).join(', ');
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
            id SERIAL PRIMARY KEY,
            ${columns},
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `;
    try {
        await pool.query(createTableQuery);
        //console.log(`[PostgreSQL] Table '${tableName}' ensured.`);
    } catch (error) {
        console.error(`[PostgreSQL] Error ensuring table '${tableName}': ${error.message}`);
        throw error;
    }
}

/**
 * Migrates data from a MongoDB collection to a PostgreSQL table.
 * @param {object} mongoDb - The MongoDB database instance.
 * @param {Pool} pgPool - The PostgreSQL connection pool.
 * @param {string} mongoCollectionName - The name of the MongoDB collection.
 * @param {string} pgTableName - The name of the PostgreSQL table.
 * @param {object} pgSchema - The target PostgreSQL schema for the table (e.g., {mongo_id: 'TEXT UNIQUE', ...}).
 * @param {function} transformFn - A function to transform a MongoDB document into a PostgreSQL row object.
 * @param {string} pgPrimaryKeyConflictColumn - The column name in PostgreSQL to use for ON CONFLICT (e.g., 'mongo_id').
 */
async function migrateCollection(mongoDb, pgPool, mongoCollectionName, pgTableName, pgSchema, transformFn, pgPrimaryKeyConflictColumn) {
    //console.log(`\n--- Starting migration for '${mongoCollectionName}' collection to '${pgTableName}' table ---`);

    await ensurePostgreSQLTable(pgPool, pgTableName, pgSchema, pgPrimaryKeyConflictColumn);

    const collection = mongoDb.collection(mongoCollectionName);
    let offset = 0;
    let totalMigrated = 0;

    try {
        while (true) {
           //console.log(`[${mongoCollectionName}] Fetching batch from MongoDB (offset: ${offset}, limit: ${BATCH_SIZE})...`);
            const documents = await collection.find({})
                                              .sort({ _id: 1 }) // Ensure consistent pagination
                                              .skip(offset)
                                              .limit(BATCH_SIZE)
                                              .toArray();

            if (documents.length === 0) {
                //console.log(`[${mongoCollectionName}] No more documents to fetch.`);
                break;
            }

            const transformedRows = documents.map(transformFn);

            // Prepare for batch insert/upsert
            const columns = Object.keys(pgSchema).concat(['created_at', 'updated_at']); // Include default columns
            const valuePlaceholders = transformedRows.map((_, rowIndex) => {
                // Generates ($1, $2, $3), ($4, $5, $6) etc. for each row
                return `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`;
            }).join(', ');

            // Flatten all values into a single array for pg.Pool.query
            const allValues = transformedRows.flatMap(row => {
                const rowValues = columns.map(col => {
                    // Handle special cases for created_at/updated_at and JSONB
                    if (col === 'created_at' && row.createdAt) return row.createdAt;
                    if (col === 'updated_at' && row.updatedAt) return row.updatedAt;
                    if (pgSchema[col] && pgSchema[col].includes('JSONB')) return JSON.stringify(row[col]); // Stringify JSONB
                    return row[col];
                });
                return rowValues;
            });

            // Construct the ON CONFLICT clause for upsert functionality
            const updateColumns = Object.keys(pgSchema)
                .filter(col => col !== pgPrimaryKeyConflictColumn) // Don't update the primary key used for conflict
                .map(col => {
                    if (pgSchema[col] && pgSchema[col].includes('JSONB')) {
                        return `${col} = EXCLUDED.${col}::jsonb`; // Ensure correct type casting for JSONB
                    }
                    return `${col} = EXCLUDED.${col}`;
                }).join(', ');

            const upsertQuery = `
                INSERT INTO ${pgTableName} (${columns.join(', ')})
                VALUES ${valuePlaceholders}
                ON CONFLICT (${pgPrimaryKeyConflictColumn}) DO UPDATE SET
                    ${updateColumns},
                    updated_at = NOW();
            `;

            //console.log(`[${mongoCollectionName}] Inserting/Upserting ${transformedRows.length} documents into PostgreSQL...`);
            await pgPool.query(upsertQuery, allValues);
            //console.log(`[${mongoCollectionName}] Successfully migrated ${transformedRows.length} documents.`);

            totalMigrated += documents.length;
            offset += documents.length;
        }
        //console.log(`[${mongoCollectionName}] Migration complete. Total documents migrated: ${totalMigrated}`);
    } catch (error) {
        console.error(`[${mongoCollectionName}] Migration failed: ${error.message}`);
    }
}

// --- Schema Definitions and Transform Functions ---

// users collection
const usersPgSchema = {
    mongo_id: 'TEXT UNIQUE',
    email: 'TEXT',
    name: 'TEXT',
    role: 'TEXT',
    data: 'JSONB',
};
const transformUser = (doc) => {
    const { _id, email, name, role, createdAt, updatedAt, ...rest } = doc;
    return {
        mongo_id: _id.toString(),
        email: email || null,
        name: name || null,
        role: role || 'user',
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
        data: rest,
    };
};

// clients collection
const clientsPgSchema = {
    mongo_id: 'TEXT UNIQUE',
    user_mongo_id: 'TEXT',
    client_name: 'TEXT',
    client_address: 'TEXT',
    contact_person_name: 'TEXT',
    contact_person_phone: 'TEXT',
    contact_person_email: 'TEXT',
    is_deleted: 'BOOLEAN',
    deleted_at: 'TIMESTAMP WITH TIME ZONE',
    data: 'JSONB',
};
const transformClient = (doc) => {
    const { _id, user, clientName, clientAddress, contactPersonName, contactPersonPhone, contactPersonEmail, isDeleted, deletedAt, createdAt, updatedAt, ...rest } = doc;
    return {
        mongo_id: _id.toString(),
        user_mongo_id: user ? user.toString() : null,
        client_name: clientName || null,
        client_address: clientAddress || null,
        contact_person_name: contactPersonName || null,
        contact_person_phone: contactPersonPhone || null,
        contact_person_email: contactPersonEmail || null,
        is_deleted: isDeleted || false,
        deleted_at: deletedAt || null,
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
        data: rest,
    };
};
// quotations collection
const quotationsPgSchema = {
    mongo_id: 'TEXT UNIQUE',
    client_mongo_id: 'TEXT', //TODO Assumes a reference to client's mongo_id
    amount: 'NUMERIC',
    status: 'TEXT',
    date: 'TIMESTAMP WITH TIME ZONE',
    items: 'JSONB',
    data: 'JSONB',
};
const transformQuotation = (doc) => {
    const { _id, clientId, amount, status, date, lineItems, createdAt, updatedAt, ...rest } = doc;
    return {
        mongo_id: _id.toString(),
        client_mongo_id: clientId ? clientId.toString() : null,
        amount: amount || 0,
        status: status || 'pending',
        date: date || new Date(),
        items: lineItems || [],
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
        data: rest,
    };
};

// invoices collection
const invoicesPgSchema = {
    mongo_id: 'TEXT UNIQUE',
    client_mongo_id: 'TEXT',
    quotation_mongo_id: 'TEXT',
    amount: 'NUMERIC',
    status: 'TEXT',
    invoice_date: 'TIMESTAMP WITH TIME ZONE',
    due_date: 'TIMESTAMP WITH TIME ZONE',
    items: 'JSONB',
    data: 'JSONB',
};
const transformInvoice = (doc) => {
    const { _id, clientId, quotationId, amount, status, invoiceDate, dueDate, lineItems, createdAt, updatedAt, ...rest } = doc;
    return {
        mongo_id: _id.toString(),
        client_mongo_id: clientId ? clientId.toString() : null,
        quotation_mongo_id: quotationId ? quotationId.toString() : null,
        amount: amount || 0,
        status: status || 'unpaid',
        invoice_date: invoiceDate || new Date(),
        due_date: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days from now
        items: lineItems || [],
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
        data: rest,
    };
};

// receipts collection
const receiptsPgSchema = {
    mongo_id: 'TEXT UNIQUE',
    invoice_mongo_id: 'TEXT',
    amount: 'NUMERIC',
    payment_method: 'TEXT',
    receipt_date: 'TIMESTAMP WITH TIME ZONE',
    data: 'JSONB',
};
const transformReceipt = (doc) => {
    const { _id, invoice, amountPaid, payment, dateIssued, createdAt, updatedAt, ...rest } = doc;
    return {
        mongo_id: _id.toString(),
        invoice_mongo_id: invoice ? invoice.toString() : null,
        amount: amountPaid || 0,
        payment_method: payment?.method || 'cash',
        receipt_date: dateIssued || new Date(),
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
        data: rest,
    };
};

// --- Main Migration Process ---

async function runMigration() {
    try {
        mongoClient = await connectMongoDB();
        pgPool = await connectPostgreSQL();

        const mongoDb = mongoClient.db(MONGODB_DB_NAME);

        // Define collections to migrate, their PG table names, schemas, transform functions, and conflict columns
        const migrations = [
            {
                mongoCollection: 'users',
                pgTable: 'users',
                pgSchema: usersPgSchema,
                transformFn: transformUser,
                pgPrimaryKeyConflictColumn: 'mongo_id'
            },
            {
                mongoCollection: 'clients',
                pgTable: 'clients',
                pgSchema: clientsPgSchema,
                transformFn: transformClient,
                pgPrimaryKeyConflictColumn: 'mongo_id'
            },
            {
                mongoCollection: 'quotations',
                pgTable: 'quotations',
                pgSchema: quotationsPgSchema,
                transformFn: transformQuotation,
                pgPrimaryKeyConflictColumn: 'mongo_id'
            },
            {
                mongoCollection: 'invoices',
                pgTable: 'invoices',
                pgSchema: invoicesPgSchema,
                transformFn: transformInvoice,
                pgPrimaryKeyConflictColumn: 'mongo_id'
            },
            {
                mongoCollection: 'receipts',
                pgTable: 'receipts',
                pgSchema: receiptsPgSchema,
                transformFn: transformReceipt,
                pgPrimaryKeyConflictColumn: 'mongo_id'
            },
            // TODO Add other collections as needed
            
        ];

        for (const migration of migrations) {
            await migrateCollection(
                mongoDb,
                pgPool,
                migration.mongoCollection,
                migration.pgTable,
                migration.pgSchema,
                migration.transformFn,
                migration.pgPrimaryKeyConflictColumn
            );
        }

        //console.log('\nAll migrations completed successfully!');

    } catch (error) {
        console.error('An error occurred during the migration process:', error.message);
        process.exit(1); // Exit with an error code
    } finally {
        // Close connections
        if (mongoClient) {
            await mongoClient.close();
            //console.log('[MongoDB] Connection closed.');
        }
        if (pgPool) {
            await pgPool.end();
            //console.log('[PostgreSQL] Connection pool closed.');
        }
    }
}

// Run the migration
runMigration();

module.exports = { runMigration };

