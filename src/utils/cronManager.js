// src/utils/cronManager.js
const jobs = [];

const registerCronJob = (name, cronJob, associatedUser = null, schedule = '') => {
  jobs.push({ name, cronJob, associatedUser, schedule });
};

const listCronJobs = () => {
  return jobs.map(({ name, cronJob, associatedUser, schedule }) => ({
    name,
    running: cronJob.getStatus ? cronJob.getStatus() === 'scheduled' : true, // Fallback to true
    schedule,
    associatedUser: associatedUser || 'System'
  }));
};

module.exports = {
  registerCronJob,
  listCronJobs
};
