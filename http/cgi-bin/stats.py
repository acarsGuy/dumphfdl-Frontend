#!/usr/bin/python3
# -*- coding: utf-8 -*-
import json
import socket
import requests
import psutil


#Import Global Settings
import sys,os
DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(DIR+'/../..')
from settings import *

def getremoteip():
	r = requests.get('https://icanhazip.com/')
	txt = r.text
	return txt.strip()

def getlocalip():
	try:
		sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
		sock.connect(('192.168.178.11', 80))
		return sock.getsockname()[0]
	except socket.error:
		try:
			return socket.gethostbyname(socket.gethostname())
		except socket.gaierror:
			return '127.0.0.1'
	finally:
		sock.close() 

def getcputemp():
	with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
		txt = f.read()
	milideg = int(txt)
	return round(milideg/1000, 2)

def getuptime():
	with open('/proc/uptime', 'r') as f:
		seconds = float(f.readline().split()[0])
	days     = int(seconds/86400)
	seconds -= days*86400
	hours    = int(seconds/3600)
	seconds -= hours*3600
	minutes  = int(seconds/60)
	seconds -= minutes*60
	seconds = round(seconds)

	txt = ""
	if days:
		txt += f"{days}d "
	if hours or days:
		txt += f"{hours}h "
	txt += f"{minutes}m {seconds}s"
	return txt

def getdiskuse():
	parts = psutil.disk_partitions()
	out = []
	for part in parts:
		mp  = part.mountpoint
		use = psutil.disk_usage(mp).percent
		out.append([mp,use])

	return out

def get_sysinfo():
	hostname = socket.gethostname()
	localIP  = getlocalip()
	remoteIP = getremoteip()
	uptime   = getuptime()
	
	CPUload  = psutil.cpu_percent(0.5)
	CPUpcore = psutil.cpu_count(logical=False)
	CPUlcore = psutil.cpu_count(logical=True)
	CPUfreq  = round(psutil.cpu_freq().current,2)
	CPUmaxf  = psutil.cpu_freq().max
	if CPUmaxf > 100: CPUmaxf /= 1000 #Correct MHz / GHz
	if CPUfreq > 100: CPUfreq /= 1000 #Correct MHz / GHz
	CPUtemp  = getcputemp()
	
	swapuse  = psutil.swap_memory().percent
	ramuse   = psutil.virtual_memory().percent
	diskuse  = getdiskuse()
	
	return {
		'hostname': hostname,
		'localIP': localIP,
		'remoteIP': remoteIP,
		'uptime': uptime,
		'CPUload': CPUload,
		'CPUpcore': CPUpcore,
		'CPUlcore': CPUlcore,
		'CPUfreq': CPUfreq,
		'CPUmaxf': CPUmaxf,
		'CPUtemp': CPUtemp,
		'swapuse': swapuse,
		'ramuse': ramuse,
		'diskuse': diskuse
	}


def get_by_needle(st,needle,length,tonumber=True):
	try:
		i = st.index(needle)
	except:
		if tonumber:
			return 0
			pass
		else:
			return ""
	x = i+len(needle)
	e = x+length
	substr = st[x:e]

	if tonumber:
		try:
			return float(substr)
		except:
			return 0
	return substr


def get_stats():
	with open(LOG_FILE,'r') as f:
		lines = f.readlines()

	data = {}

	for line in lines:
		ts    = get_by_needle(line,'"t":{"sec":', 10)
		slvl = get_by_needle(line,'"sig_level":', 6)
		nlvl  = get_by_needle(line,'"noise_level":', 6)

		if ('"pos":{' in line) or ('"ac_location":{' in line) or ('"basic_report":{' in line) or ('"position":{"lat":' in line):
			pos = 1
		else:
			pos = 0

		index = str(int(ts/STATS_INTERVAL))

		if index in data:
			data[index][0] += 1
			data[index][1] += pos
			data[index][2] += slvl
			data[index][3] += nlvl
		else:
			data[index] = [1,pos,slvl,nlvl]

	out = []
	for x in data:
		outts    = int(x)*STATS_INTERVAL
		outc     = data[x][0]
		outp     = data[x][1]
		avg_slvl = round(data[x][2]/outc,2)
		avg_nlvl = round(data[x][3]/outc,2)
		out.append([outts,outc,outp,avg_slvl,avg_nlvl])

	return out[1:-1]

out = {
	'sysinfo': get_sysinfo(),
	'stats':   get_stats()
}

print('Content-Type: application/json\n\r')
print(json.dumps(out))