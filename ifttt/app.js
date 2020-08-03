let response
const axios = require('axios')
const moment = require('moment')
const AWS = require('aws-sdk')
const pinpoint = new AWS.Pinpoint()


function processEndpoints (campaignID, endpoints, pinpointEvents) {
  return new Promise((resolve, reject) => {
    try {
      let axiosArray = []
      Object.keys(endpoints).forEach(function (endpointID) {
        var endpoint = endpoints[endpointID]

        let postData = {}
        postData.value1 = `New Message for: ${endpointID}`
        postData.value2 = endpointID
        let newPromise = axios({
            method: 'post',
            url: process.env.IFTTTWEBHOOKURL,
            data: postData
          })
        axiosArray.push(newPromise)
      })
        
      axios.all(axiosArray)
      .then(axios.spread((...responses) => {
        responses.forEach(res => {
          var returnedEndpointID = JSON.parse(res.config.data).value2
          if (res.status === 200){
            console.log('Success')
            pinpointEvents[returnedEndpointID] = createPinpointSuccess(returnedEndpointID, campaignID)
          } else {
            console.log('Error')
            pinpointEvents[returnedEndpointID] = createPinpointError(JreturnedEndpointID, campaignID, res,status, res.statusText)
          }
        })
        console.log('submitted all axios calls');
        resolve()
      }))
      .catch(err => {
        console.error(err)
        reject(err)
      })
    } catch (ex) {
      reject(ex)
    }
  })
}

function createPinpointSuccess (endpointID, campaignID) {
  var customEvent = {
    Endpoint: {},
    Events: {}
  }

  customEvent.Events[`ifttt_${endpointID}_${campaignID}`] = {
    EventType: 'ifttt.success',
    Timestamp: moment().toISOString(),
    Attributes: {
      endpointID: endpointID
    }
  }
  return customEvent
}
function createPinpointError (endpointID, campaignID, status, err) {
  var customEvent = {
    Endpoint: {},
    Events: {}
  }

  customEvent.Events[`ifttt_${endpointID}_${campaignID}`] = {
    EventType: 'ifttt.error',
    Timestamp: moment().toISOString(),
    Attributes: {
      endpointID: endpointID,
      status: status,
      err: JSON.stringify(err)
    }
  }
  return customEvent
}

function processEvents (applicationId, events) {
  return new Promise((resolve) => {
    var params = {
      ApplicationId: applicationId,
      EventsRequest: {
        BatchItem: events
      }
    }

    pinpoint.putEvents(params, function (err) {
      if (err) {
        console.log(err, err.stack)
        resolve() // Just going to log and return
      } else {
        resolve()
      }
    })
  })
}

function sendIFTTTEvents (event) {
  return new Promise((resolve, reject) => {
    try {
      if (event.Endpoints.length === 0) {
        resolve({ message: 'no endpoints to process' })
      }

        var campaignID = event.CampaignId
        var pinpointEvents = {}

        processEndpoints(campaignID, event.Endpoints, pinpointEvents)
          .then(function () {
            return processEvents(event.ApplicationId, pinpointEvents)
          })
          .then(function () {
            resolve({ message: 'success' })
          })
          .catch(function (err) {
            console.error(`unhandled exception updating ifttt: ${JSON.stringify(err)}`)
            reject({ message: `unhandled exception: ${err}` })
          })
    } catch (err) {
      console.error(`unknown error: ${JSON.stringify(err)}`)
      reject({ message: `unknown error: ${JSON.stringify(err)}` })
    }
  })
}

exports.handler = async (event, context) => {
  console.log(JSON.stringify(event))
  var body = await sendIFTTTEvents(event)

  response = {
    statusCode: 200,
    body: JSON.stringify(body)
  }

  return response
}
