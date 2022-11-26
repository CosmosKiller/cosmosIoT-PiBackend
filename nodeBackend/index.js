var mysql = require('mysql');
var mqtt = require('mqtt');

// MySql credentials
var conn = mysql.createConnection({
	host: 'localhost',
  user: 'admin_cosmos-iot',
  password: 'peru1843',
  database:'admin_devices_management'
});

// Mqtt credentials
var options = {
  port: 1883,
  host: 'localhost',
  clientId: 'cosmosiot_node_' + Math.round(Math.random() * (0 - 10000) * -1),
  username: 'backend_client',
  password: '94KJt7J*:hRzru:5',
  keepalive: 60,
  reconnectPeriod: 1000,
  protocolId: 'MQIsdp',
  protocolVersion: 3,
  clean: true,
  encoding: 'utf8'
};

const WebSocket_URL = 'mqtt://localhost'
const client = mqtt.connect(WebSocket_URL, options);

// Gobal Variables
var devState = {} //Stores the state of a device {0: Off, 1: On, 2: Off-line}

// Mqtt connection
client.on('connect', function () {

  // Connection to mqtt entablished
  console.log('¡Conexión a MQTT exitosa!');

  client.subscribe('+/tx_controll', function (err) {});
  client.subscribe('+/rx_controll', function (err) {});
  client.subscribe('+/rx_state', function (err) {});
});

// Mqtt message callback function
client.on('message', (topic, message) =>{
  console.log('Recibido desde ->', topic, '; Mensaje ->', message.toString());

  var splitted_topic = topic.split("/");
  var serial_number = splitted_topic[0];
  var query = splitted_topic[1];
  var msg = message.toString();

  if (query == "tx_controll") // Transmit msg to a device
  {
    var splitted_msg = msg.split(",");
    var user_id = splitted_msg[0];
    var command = splitted_msg[1];

    // First query returns (if exists) a user that it's allow to access to the device
    var query = "SELECT * FROM `users_acl` WHERE `users_account_id` = '" + user_id + "' AND `devices_serial` = '" + serial_number + "'";
    // Second query returns the owner of the device
    var query2 = "SELECT * FROM `users_acl` WHERE `devices_serial` = '" + serial_number + "' AND `users_level` = '3'";

    conn.query(query, function(err, result, fields)
    {
      if (err) throw err;

      /*
      There must be a unique combination for the
      specified user_id and serial_number.
      Two or more results might indicate an error in the DB,
      and for security reasons, access to device is denied. 
      */
      if (result.length == 1) 
      {
        var lvl = result[0]['users_level'];
        var type = result[0]['type_classification'];
        var newTopic = "";

        if (type == "HUB")
          newTopic = "/Homehubs";
        else if (type == "LSC")
          newTopic = "/Lights";
        else if (type == "SKT")
          newTopic = "/Sockets";
        else if (type == "SNR")
          newTopic = "/Sensors";
        else if (type == "CAM")
          newTopic = "/Cameras";
        else if (type == "MOT")
          newTopic = "/Motors";

        if (lvl != 0)
        {
          /*
          Only users with correct permission are
          allowed to access the device, ie, to publish in the
          specified topic.
          */
          client.publish(serial_number + newTopic, command);
          
          /*
          This function works a a flag checker;
          If the serial number of the device we are trying to reach 
          isn´t stored in devState, that means we never recived an answer from 
          that device, so we asume it's disconected from the broker.
          This functions works with the condition set in line 184
          */
          setTimeout(function(){
            if (devState[serial_number] === undefined)
            {
              client.publish(serial_number + "/Coms", user_id + ",Undefined");
              client.publish(serial_number + "/Status/online", "2", {qos: 0, retain: true});
            }
            else
            {
              client.publish(serial_number + "/Coms", user_id + ",Granted");
              if (type == "LSC" && command != "000/000/000/000/")
                client.publish(serial_number + "/Status/rgbState", command, {qos: 0, retain: true});
            }
          }, 150);
        }
        else
        {
          // Invalid user, doesn't have enough permission
          client.publish(serial_number + "/Coms", user_id + ",Refused");
        }
      }
      else
      {
        // No user found
        conn.query(query2, function(err2, result2)
        {
          if (err2) throw err2;

          if (result2.length == 1)
          {
            var owner = result2[0]['owners_account_id'];
            client.publish(serial_number + "/Coms", owner + ",Nonexistent");
          }
        });
      }
    });
  } 
  else if (query == "rx_controll") // Receive msg from a device
  {
    var query = "SELECT * FROM `users_acl` WHERE `devices_serial` = '" + serial_number + "'";
    conn.query(query, function(err, result, fields)
    {
      if (err) throw err;

      if (result.length > 0)
      {
        var usr = [];
        var lvl = [];
        var type = [];
        var subtype = "/" + serial_number.slice(3, 5);
        var newTopic = "";

        for (var i = 0 ; i < result.length ; i++)
        {
          usr[i] = result[i]['users_account_id'];
          lvl[i] = result[i]['users_level'];
          type[i] = result[i]['type_classification'];
        
          if (type == "HUB")
            newTopic = "/Homehubs";
          else if (type == "LSC")
            newTopic = "/Lights";
          else if (type == "SKT")
            newTopic = "/Sockets";
          else if (type == "SNR")
            newTopic = "/Sensors";
          else if (type == "CAM")
            newTopic = "/Cameras";
          else if (type == "MOT")
            newTopic = "/Motors";

          if (lvl[i] != 0)
          {
            // WWe'll only publish the message for enabled users
            client.publish(serial_number + newTopic + subtype, usr[i] + "," + msg);
          }
        }  
      }
    });
  }
  else if (query == "rx_state") // Receive a flag from a device
  {
    /*
    This functions work in conjunction with the setTimeout function
    setted in line 107.
    If a device recibes the command sended from our web client, it'll publish back
    a msg with it's current state (on/off).
    Then we'll store that value in our devSerial object, so we could check it's status later 
    */
    devState[serial_number] = msg;
    client.publish(serial_number + "/Status/online", msg, {qos: 0, retain: true});

    /*
    After an apropiate amout of time we empty our object,
    so if any device goes offline, it won't be any response from it
    and its state won't be stored.
    Then the condition established in line 108 will tell us that the device
    is, indeed, offline
    */
    setTimeout(function()
    {
      devState = {};
    }, 3000);
  }
});

conn.connect(function(err) {
  if (err) throw err;

  // Connection MySQL entablished
  console.log('¡Conexión a MySql exitosa!');
});

// To keep alive the MySql session
setInterval(function() {
  var query = 'SELECT 1 + 1 as result';

  conn.query(query, function(err, result, fields) {
    if (err) throw err;
  });
}, 5000);