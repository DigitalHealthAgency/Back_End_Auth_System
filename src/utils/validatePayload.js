// utils/validatePayload.js
function validatePayload(payload, requiredFields = []) {
    const missingFields = [];

    requiredFields.forEach(field => {
        const value = payload[field];

        // Handle nested fields like payment.amountPaid
        if (field.includes('.')) {
            const parts = field.split('.');
            let current = payload;
            for (const part of parts) {
                current = current?.[part];
                if (current === undefined || current === null) {
                    missingFields.push(field);
                    break;
                }
            }
        } else {
            if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
                missingFields.push(field);
            }
        }
    });

    return missingFields;
}

module.exports = validatePayload;
