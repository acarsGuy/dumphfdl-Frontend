#!/usr/bin/python3
# -*- coding: utf-8 -*-
import json
import cgi
import time

#Import Global Settings
import sys,os
DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(DIR+'/../..')
from settings import *


try:
	form = cgi.FieldStorage()
	duration  = int(form.getvalue('duration'))
except:
	duration = 3600

if not duration:
	duration = 3600
mintime = time.time()-duration

with open(LOG_FILE,'r') as f:
	lines = f.readlines()

lines.reverse()

output = {
	'mode': "",
	'data': {}
}

for line in lines:
	try:
		d = json.loads(line)
	except json.JSONDecodeError:
		continue

	if 'hfdl' in d:
		output['mode'] = 'HFDL';
		uts = d['hfdl']['t']['sec']
		if uts < mintime:
			break


		freq = str(d['hfdl']['freq'])
		if not (freq in output['data']):
			output['data'][freq] = {'total':0,'mpdu':0,'spdu':0,'lpdu':0,'hfnpdu':0}

		output['data'][freq]['total'] += 1

		if 'mpdu' in d['hfdl']:
			output['data'][freq]['mpdu'] += 1
		if 'spdu' in d['hfdl']:
			output['data'][freq]['spdu'] += 1
		if 'lpdu' in d['hfdl']:
			if 'hfnpdu' in d['hfdl']['lpdu']:
				output['data'][freq]['hfnpdu'] += 1
			else:
				output['data'][freq]['lpdu'] += 1

	if 'vdl2' in d:
		output['mode'] = 'VDL2';
		uts = d['vdl2']['t']['sec']
		if uts < mintime:
			break

		if not 'avlc' in d['vdl2']:
			continue

		freq = str(d['vdl2']['freq'])
		if not (freq in output['data']):
			output['data'][freq] = {'total':0,'acars':0,'xid':0,'x25':0,'other':0}

		output['data'][freq]['total'] += 1

		if 'acars' in d['vdl2']['avlc']:
			output['data'][freq]['acars'] += 1
		elif 'xid' in d['vdl2']['avlc']:
			output['data'][freq]['xid'] += 1
		elif 'x25' in d['vdl2']['avlc']:
			output['data'][freq]['x25'] += 1
		else:
			output['data'][freq]['other'] += 1



print('Content-Type: application/json\n\r')
print(json.dumps(output))
