/* eslint-disable max-len */
const cron = require('node-cron');
const moment = require('moment');
const path = require('path');
const ZWaveController = require('./zwave.controller');
const ZWaveService = require('./zwave.service');
const mqttAPI = require('../../MQTT/index');

const { mqttLocalClient } = mqttAPI.mqttApi;
const mqttCloud = require('./zwave.cloud.mqtt');

const config = path.join(__dirname, '../../../environment/config/config.json');
const startCheckPoller = async () => {
  // eslint-disable-next-line no-console
  console.log('Starting checking data...');
  // ONLY FOR QUBINO
  cron.schedule('*/20 * * * *', async () => {
    // eslint-disable-next-line no-console
    console.log('check...');
    const readconfig = ZWaveService.readDevicesFile();
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < readconfig.devices.length; i++) {
      let isStucked = false;
      // Check to exclude the environmental sensor
      if (readconfig.devices[i].nodeId !== 4) {
        // eslint-disable-next-line no-plusplus
        for (let j = 0; j < readconfig.devices[i].specifics.length; j++) {
          if (readconfig.devices[i].specifics[j].timestamp && !readconfig.devices[i].specifics[j].hidden) {
            // eslint-disable-next-line max-len
            const timeBef = moment(readconfig.devices[i].specifics[j].timestamp);
            if (moment().isAfter(timeBef) && moment().diff(timeBef, 'minutes') > 17) {
              console.log('Device issue');
              // eslint-disable-next-line no-unused-vars
              const node = { args: [readconfig.devices[i].nodeId, 50] };
              isStucked = true;
              if (readconfig.devices[i].specifics.length - 1 === j && isStucked) {
                mqttLocalClient.publish('zwave/_CLIENTS/ZWAVE_GATEWAY-Zwavejs2Mqtt/api/refreshCCValues/set', JSON.stringify(node));
                isStucked = false;
              }
            }
          }
        }
      }
    }
  });
};

const sendDataBroker = async (data) => {
  if (data.length !== 0) {
    const options = {
      url: 'http://localhost:3009/api/v1/databroker/zwave/data',
      method: 'post',
      headers:
                {
                  'Cache-Control': 'no-cache',
                  'Content-Type': 'application/json',
                },
      data: {
        devices: [data],
      },

    };
    const response = await axios.request(options)
      .catch((error) => {
        throw new ErrorHandler(400, error);
      });
    return response.data;
  }
  return null;
};


const startZwavePoller = async () => {
  // eslint-disable-next-line no-console
  console.log('Starting polling data...');
  // ONLY FOR QUBINO
  cron.schedule('*/10 * * *', async () => {
    // eslint-disable-next-line no-console
    console.log('10 sec...');
    const qubino = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < qubino.length; i++) {
      // or other nodeId that cannot report data in 10s frequency
      const node10s = { args: [qubino[i], 50] };

      // eslint-disable-next-line no-unused-vars
      mqttLocalClient.publish('zwave/_CLIENTS/ZWAVE_GATEWAY-Zwavejs2Mqtt/api/refreshCCValues/set', JSON.stringify(node10s));
    }
  });
};

const subscribeToTopic = async (topic) => mqttLocalClient.subscribe(topic, { qos: 2 });

mqttLocalClient.on('connect', async () => {
  // eslint-disable-next-line no-console
  // console.log('Local MQTT connected');
  mqttLocalClient.subscribe('zwave/#', { qos: 2 });
  await startZwavePoller();
  // await startCheckPoller();
});

// eslint-disable-next-line consistent-return
mqttLocalClient.on('message', async (topic, data) => {
  const nodes = JSON.parse(data.toString());
  if (topic.split('/')[4] === 'getNodes') {
    await ZWaveController.getNodes(nodes);
  } else if (topic.split('/')[1] !== '_CLIENTS') {
    let findDeviceInfo;
    const readconfig = ZWaveService.readDevicesFile();
    findDeviceInfo = readconfig.devices.findIndex((i) => i.reference === topic.split('/')[1]);
    if (findDeviceInfo !== -1) {
      if ((topic.split('/')[4] === 'currentValue' || topic.split('/')[4] === 'targetValue') && topic.split('/')[3] === '1') {
        await mqttCloud.publishToTopic(`gateways/actuator/${readconfig.MAC}/updateValue`, {
          action: 'updateValue',
          cloudDeviceId: readconfig.devices[findDeviceInfo].deviceId,
          value: nodes.value,
        });
      } else {
        // eslint-disable-next-line max-len
        const findUnit = readconfig.devices[findDeviceInfo].specifics.findIndex((i) => i.state_topic === topic);
        if (findUnit !== -1) {
          if (!readconfig.devices[findDeviceInfo].specifics[findUnit].hidden) {
            if (readconfig.devices[findDeviceInfo].specifics[findUnit].unit_of_measurement) {
              const timeIn = moment(nodes.time);
              // eslint-disable-next-line max-len
              const timeBef = moment(readconfig.devices[findDeviceInfo].specifics[findUnit].timestamp);
              // console.log( timeIn.diff(timeBef, 'seconds'))
              if (
                timeIn.isAfter(timeBef) && timeIn.diff(timeBef, 'seconds') > 5) {
                const body = {
                  deviceId: readconfig.devices[findDeviceInfo].deviceId,
                  fields: {},
                  timestamp: nodes.time,
                };
                if (readconfig.devices[findDeviceInfo].specifics[findUnit].device_class) {
                  body.fields[`${readconfig.devices[findDeviceInfo].specifics[findUnit].device_class} (${readconfig.devices[findDeviceInfo].specifics[findUnit].unit_of_measurement})`] = nodes.value;
                } else {
                  body.fields[`${readconfig.devices[findDeviceInfo].specifics[findUnit].object_id} (${readconfig.devices[findDeviceInfo].specifics[findUnit].unit_of_measurement})`] = nodes.value;
                }
                if (readconfig.devices[findDeviceInfo].specifics[findUnit].unit_of_measurement === 'kWh') {
                  const timeDiff = timeIn.diff(timeBef, 'minutes');
                  const { maxW, type } = readconfig.devices[findDeviceInfo];
                  const valueIn = nodes.value;
                  const valueBef = readconfig.devices[findDeviceInfo].specifics[findUnit].value;
                  if (
                    timeIn.isAfter(timeBef) && timeDiff > 13) {
                    // eslint-disable-next-line no-prototype-builtins
                    if (readconfig.devices[findDeviceInfo].hasOwnProperty('type') && readconfig.devices[findDeviceInfo].hasOwnProperty('maxW')) {
                      if (valueBef) {
                        const check = await ZWaveService.checkEnergySpikes(type, maxW, valueIn, valueBef, timeDiff, body.deviceId);
                        if (check) {
                          await ZWaveController.sendRemoteDataBroker(body);
                          readconfig.devices[findDeviceInfo].specifics[findUnit].value = nodes.value;
                          readconfig.devices[findDeviceInfo].specifics[findUnit].timestamp = nodes.time;
                          await ZWaveService.updateConfigFile(config, readconfig);
                        }
                      } else {
                        readconfig.devices[findDeviceInfo].specifics[findUnit].value = nodes.value;
                        readconfig.devices[findDeviceInfo].specifics[findUnit].timestamp = nodes.time;
                        await ZWaveService.updateConfigFile(config, readconfig);
                      }
                    } else {
                      await ZWaveController.sendRemoteDataBroker(body);
                      readconfig.devices[findDeviceInfo].specifics[findUnit].value = nodes.value;
                      readconfig.devices[findDeviceInfo].specifics[findUnit].timestamp = nodes.time;
                      await ZWaveService.updateConfigFile(config, readconfig);
                    }
                  }
                } else {
                  await sendDataBroker(body);
                  readconfig.devices[findDeviceInfo].specifics[findUnit].timestamp = nodes.time;
                  await ZWaveService.updateConfigFile(config, readconfig);
                }
              } else {
                readconfig.devices[findDeviceInfo].specifics[findUnit].timestamp = nodes.time;
                await ZWaveService.updateConfigFile(config, readconfig);
              }
            }
          }
        }
      }
    } else {
      findDeviceInfo = readconfig.devices.findIndex((i) => i.nodeId === nodes.nodeId);
      if (findDeviceInfo !== -1) {
        if (topic.split('/')[4] === 'currentValue' || topic.split('/')[4] === 'targetValue') {
          const cloudDeviceId = readconfig.devices.findIndex((j) => j.nodeId === parseInt(nodes.nodeId));
          await mqttCloud.publishToTopic(`gateways/actuator/${readconfig.MAC}/updateValue`, {
            action: 'updateValue',
            cloudDeviceId: readconfig.devices[cloudDeviceId].deviceId,
            value: nodes.value,
          });
        } else {
          // eslint-disable-next-line max-len
          const findValueId = readconfig.devices[findDeviceInfo].reads.findIndex((i) => i.valueId === nodes.id);
          if (findValueId !== -1) {
            if (!readconfig.devices[findDeviceInfo].reads[findValueId].hidden) {
              if (readconfig.devices[findDeviceInfo].reads[findValueId].unit) {
                const timeIn = moment(nodes.lastUpdate);
                // eslint-disable-next-line max-len
                const timeBef = moment(readconfig.devices[findDeviceInfo].reads[findValueId].timestamp);
                if (
                  timeIn.isAfter(timeBef) && timeIn.diff(timeBef, 'seconds') > 7) {
                  const body = {
                    deviceId: readconfig.devices[findDeviceInfo].deviceId,
                    fields: {},
                    timestamp: nodes.lastUpdate,
                  };
                  if (readconfig.devices[findDeviceInfo].reads[findValueId].label) {
                    body.fields[`${readconfig.devices[findDeviceInfo].reads[findValueId].label}`] = nodes.value;
                  } else {
                    body.fields[`${readconfig.devices[findDeviceInfo].reads[findValueId].unit}`] = nodes.value;
                  }
                  if (readconfig.devices[findDeviceInfo].reads[findValueId].label === 'power (kWh)') {
                    const timeDiff = timeIn.diff(timeBef, 'minutes');
                    const { maxW, type } = readconfig.devices[findDeviceInfo];
                    const valueIn = nodes.value;
                    const valueBef = readconfig.devices[findDeviceInfo].reads[findValueId].value;
                    if (
                      timeIn.isAfter(timeBef) && timeDiff > 13) {
                      // eslint-disable-next-line no-prototype-builtins
                      if (readconfig.devices[findDeviceInfo].hasOwnProperty('type') && readconfig.devices[findDeviceInfo].hasOwnProperty('maxW')) {
                        if (valueBef) {
                          if (ZWaveService.checkEnergySpikes(type, maxW, valueIn, valueBef, timeDiff)) {
                            await ZWaveController.sendRemoteDataBroker(body);
                            readconfig.devices[findDeviceInfo].reads[findValueId].value = nodes.value;
                            readconfig.devices[findDeviceInfo].reads[findValueId].timestamp = nodes.lastUpdate;
                            await ZWaveService.updateConfigFile(config, readconfig);
                          }
                        } else {
                          readconfig.devices[findDeviceInfo].reads[findValueId].value = nodes.value;
                          readconfig.devices[findDeviceInfo].reads[findValueId].timestamp = nodes.lastUpdate;
                          await ZWaveService.updateConfigFile(config, readconfig);
                        }
                      } else {
                        await ZWaveController.sendRemoteDataBroker(body);
                        readconfig.devices[findDeviceInfo].reads[findValueId].value = nodes.value;
                        readconfig.devices[findDeviceInfo].reads[findValueId].timestamp = nodes.lastUpdate;
                        await ZWaveService.updateConfigFile(config, readconfig);
                      }
                    }
                  } else {
                    await sendDataBroker(body);
                    // eslint-disable-next-line max-len
                    readconfig.devices[findDeviceInfo].reads[findValueId].timestamp = nodes.lastUpdate;
                    await mqttCloud.publishToTopic(`gateways/actuator/${readconfig.MAC}/updateValue`, {
                      action: 'updateValue_power',
                      cloudDeviceId: readconfig.devices[findDeviceInfo].deviceId,
                      value: nodes.value,
                    });
                    await ZWaveService.updateConfigFile(config, readconfig);
                  }
                } else {
                  // eslint-disable-next-line max-len
                  readconfig.devices[findDeviceInfo].reads[findValueId].timestamp = nodes.lastUpdate;
                  await ZWaveService.updateConfigFile(config, readconfig);
                }
              }
            }
          }
        }
      } else {
        // eslint-disable-next-line no-unused-vars
        mqttLocalClient.publish('zwave/_CLIENTS/ZWAVE_GATEWAY-Zwavejs2Mqtt/api/getNodes/set', JSON.stringify({}), { qos: 2 }, (err) => {
        });
      }
    }
  }
});

exports.subscribeToTopic = subscribeToTopic;
exports.startZwavePoller = startZwavePoller;
