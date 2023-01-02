#!/usr/bin/python3
# -*- coding: utf-8 -*-
import os
import multiprocessing
import http.server
import zmq
from websocket_server import WebsocketServer
import settings

DIR        = os.path.dirname(os.path.realpath(__file__))

def receiver():
	context = zmq.Context()
	socket = context.socket(zmq.SUB)
	socket.connect(f"tcp://127.0.0.1:{settings.ZMQ_PORT}")
	socket.setsockopt(zmq.SUBSCRIBE, b'')

	wss = WebsocketServer(host='', port=settings.WS_PORT)
	wss.run_forever(True)

	while True:
		string = socket.recv_string()
		wss.send_message_to_all(string)

def startHTTP():
	class Handler(http.server.CGIHTTPRequestHandler):
		def log_message(self, format, *args):
			#Stop annoying logging to stderr
			return

	class Server(http.server.ThreadingHTTPServer):
		def finish_request(self, request, client_address):
			#Set docroot
			self.RequestHandlerClass(request, client_address, self, directory=DIR+settings.HTTP_DIR)

	with Server(('',settings.HTTP_PORT), Handler) as httpd:
		httpd.serve_forever()

#Start HTTP Server
multiprocessing.Process(target=startHTTP).start()

receiver()