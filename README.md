# dumphfdl-Frontend
A simple web frontend for dumphfdl and dumpvdl2
## Features
- Live Messages
- Log file Viewer
- No external HTTP-Server needed (using Python's SimpleHTTP-Server)

## Useage
- Add a JSON log file to your dumphfdl command ("--output decoded:json:file:path=/home/pi/hfdl.log")
- Add ZMQ output to your dumphfdl command ("--output decoded:json:zmq:mode=server,endpoint=tcp://*:5555")
- Run dumphfdl
- Start server.py
- Open "http://<device-ip>:8000/" in your browser

HTTP port (default: 8000) and log file path (default: /home/pi/hfdl.log) can be set in settings.py  **This might be necessary**

## TODO
- Many things could be made better (Ugly hack)
- VDLM2 X25 messages are not fully implemented 

## Credits
This software uses:
- python-websocket-server: https://github.com/Pithikos/python-websocket-server
- Oxygen Icons: https://github.com/KDE/oxygen-icons
- Leaflet: https://leafletjs.com/
- Leaflet-Fullscreen: https://github.com/Leaflet/Leaflet.fullscreen/
- Leaflet Colormarkers: https://github.com/patrickp-rthinfo/leaflet-color-markers/
