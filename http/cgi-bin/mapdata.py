#!/usr/bin/python3
# -*- coding: utf-8 -*-
import json

#Import Global Settings
import sys,os
DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(DIR+'/../..')
from settings import *

def detree(a,tree):
	keys = tree.split('/')
	sub_a = a
	for k in keys:
		if not isinstance(sub_a, dict) or (not k in sub_a):
			return None
		sub_a = sub_a[k]
	return sub_a

def get_position(d):
	#HFNPDU
	pos = detree(d, 'hfdl/lpdu/hfnpdu/pos')
	if (pos):
		return pos['lat'],pos['lon']
	#VDL Param
	pps = detree(d, 'vdl2/avlc/xid/vdl_params')
	if pps:
		for pp in pps:
			if pp['name'] != "ac_location":
				continue
			if not pp['value']['loc'] or not pp['value']['loc']['lat'] or not pp['value']['loc']['lon']:
				continue
			return pp['value']['loc']['lat'],pp['value']['loc']['lon']

	#libacars
	tags = detree(d, 'hfdl/lpdu/hfnpdu/acars/arinc622/adsc/tags')
	if tags:
		tags = detree(d, 'vdl2/avlc/acars/arinc622/adsc/tags')

	if not tags:
		return False,False

	for tag in tag:
		if not 'basic_report' in tag:
			continue
		if not tag['basic_report']['lat'] or not tag['basic_report']['lon']:
			continue
		return tag['basic_report']['lat'],tag['basic_report']['lon']

	#adsv2
	pos = detree(d, 'vdl2/avlc/x25/clnp/cotp/adsc_v2/adsc_report/data/periodic_report/report_data/position')

	if not pos:
		pos = detree(d,'vdl2/avlc/x25/clnp/cotp/x225_spdu/x227_apdu/adsc_v2/adsc_report/data/periodic_report/report_data/position')
	if not pos:
		pos = detree(d,'vdl2/avlc/x25/clnp/cptp/x225_spdu/x227_apdu/context_mgmt/cm_aircraft_message/data/atn_context_mgmt_logon_request/adsc_v2/adsc_report/data/periodic_report/report_data/position')

	if pos:
		try:
			lat  = pos['lat']['deg']
			lat += pos['lat']['min'] / 60
			lat += pos['lat']['sec'] / 3600
			if pos['lat']['dir'] == 'south':
				lat *= -1

			lon  = pos['lon']['deg']
			lon += pos['lon']['min'] / 60
			lon += pos['lon']['sec'] / 3600
			if pos['lon']['dir'] == 'west':
				lon *= -1

			return lat,lon
		except:
			pass
		


with open(LOG_FILE) as f:
	lines = f.readlines()


out = []
for line in lines:
	try:
		d = json.loads(line)
	except json.JSONDecodeError:
		continue

	if 'hfdl' in d:
		ts       = detree(d,'hfdl/t/sec')
		icao     = detree(d,'hfdl/lpdu/ac_info/icao')
		gs       = detree(d,'hfdl/lpdu/dst/name')
		freq     = detree(d,'hfdl/freq')
	elif 'vdl2' in d:
		ts       = detree(d, 'vdl2/t/sec')
		icao     = detree(d, 'vdl2/avlc/src/addr')
		gs       = ""
		freq     = detree(d, 'vdl2/freq')
	else:
		continue

	lat,lon = get_position(d)
	if not ts or not lat or not lon or not freq:
		continue
	if not (-180 < lon < 180):
		continue
	if not (-90 < lat < 90):
		continue

	out.append([ts,icao,gs,freq,lat,lon])

print('Content-Type: application/json\n')
print(json.dumps(out))