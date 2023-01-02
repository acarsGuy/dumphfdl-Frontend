#!/usr/bin/python3
# -*- coding: utf-8 -*-
import json
import cgi


#Import Global Settings
import sys,os
DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.append(DIR+'/../..')
from settings import *


form = cgi.FieldStorage()
fullsear = form.getvalue('fullsearch')

with open(LOG_FILE, 'r') as f:
	lines = f.readlines()


out = []
for line in lines:
	#Fullsearch
	if fullsear:
		if fullsear in line:
			out.append(line)

print("Content-type: application/json\r\n")
print(json.dumps(out))
