import os
import wiringpi as wp
import paho.mqtt.client as mqtt
from time import sleep
from random import randint
from dotenv import load_dotenv, find_dotenv

# Gathering environment variables
load_dotenv(find_dotenv())
serialNumber = os.getenv('SERVER_SERIAL_NUMBER')
EMQX_USER= os.getenv('EMQX_USER')
EMQX_PASSWORD= os.getenv('EMQX_PASSWORD')
EMQX_HOST= os.getenv('EMQX_HOST')
EMQX_PORT= os.getenv('EMQX_PORT')

SERIAL_NUMBER = serialNumber

# New instance with defined parameters
client = mqtt.Client('cosmosiot_python_' + str(randint(1, 100001)), True)


# Mqtt connection 
def on_connect(client, userdata, flags, rc):
    if rc==0:
        print("connected OK Returned code=",rc)
    else:
        print("Bad connection Returned code=",rc)
    # 1: Connection refused – incorrect protocol version
    # 2: Connection refused – invalid client identifier
    # 3: Connection refused – server unavailable
    # 4: Connection refused – bad username or password
    # 5: Connection refused – not authorised
    # 6-255: Currently unused.

    client.subscribe(SERIAL_NUMBER + "/#")


# Mqtt incoming msg
def on_message(client, userdata, msg):
    newMsg = str(msg.payload)[6:17]
    
    if msg.topic == SERIAL_NUMBER + "/Lights":
        if newMsg == "000/000/000":
            wp.digitalWrite(15, 0)
            client.publish(SERIAL_NUMBER + "/rx_state", "0")
        else:
            wp.digitalWrite(15,1)
            client.publish(SERIAL_NUMBER + "/rx_state", "1")
    
    if msg.topic == SERIAL_NUMBER + "/Sensors":
        pass


def main():
    wp.wiringPiSetupGpio()
    wp.pinMode(15, 1)
    wp.digitalWrite(15, 0)

    client.on_connect = on_connect
    client.on_message = on_message

    client.username_pw_set(EMQX_USER, EMQX_PASSWORD) # Mqtt_acl auth credentials
    client.connect(EMQX_HOST, EMQX_PORT, 60)
    client.loop_forever()



if __name__ == '__main__':
    main()