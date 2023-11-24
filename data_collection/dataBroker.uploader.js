/* eslint-disable no-await-in-loop */
const PgBoss = require('pg-boss');
const fs = require('fs').promises;
const axios = require('axios').default;

const { db } = require('../../databases/postgresql');

const config = require('../../../environment');

let remotes;

async function cloudUploader(job) {
  const dupload = job.data.uploadData;
  try {
    if (dupload.data.remote.remote.startsWith('cloudgr')) {
      const dataRemote = dupload.data.remote.remote;
      if (dupload.data.remote.method === 'http') {
        const body = {
          timestamp: new Date(dupload.data.timestamp).getTime(),
          fields: dupload.data.measurements,
          deviceId: parseInt(dupload.data.deviceId, 10),
        };
        try {
          await axios.post(
            `${remotes[dataRemote].http.host}/api/v1/databroker/${remotes[dataRemote].http.gateway_api_id}/data`,
            {
              apiSecret: remotes[dataRemote].http.gateway_api_secret,
              devices: [body],
            }
          );
          await db.none(`update data set uploaded = true where id = $1`, [dupload.id]);
        } catch (error) {
          if (error.response.data.statusCode === 403) {
            await db.none(`update data set uploaded = true where id = $1`, [dupload.id]);
          } else if (error.response.data.statusCode === 400) {
            if (
              error.response.data.payload.message ===
              'Database Error: Unique violation of timestamp and device_id'
            ) {
              await db.none(`update data set uploaded = true where id = $1`, [dupload.id]);
            }
          }
        } finally {
     
          if (process.env.DELETE_UPLOADED_DATA) {
            await db.none(`delete from data where id = $1 and uploaded = true`, [dupload.id]);
          }
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
}

const boss = new PgBoss({
  host: config.postgresql.host,
  user: config.postgresql.user,
  password: config.postgresql.password,
  port: config.postgresql.port,
  database: config.postgresql.database,
});

async function startWork() {
  await boss.work('cloud-uploader', { teamSize: 50, teamConcurrency: 50 }, cloudUploader);
}

async function stopWork() {
  await boss.offWork('cloud-uploader');
}

async function startBoss() {
  const rawdata = await fs.readFile('config.json');
  remotes = JSON.parse(rawdata).remotes;

  boss.on('error', (error) => console.error(error));

  await boss.start();
  await startWork();
}

startBoss();

module.exports = { startWork, stopWork };
