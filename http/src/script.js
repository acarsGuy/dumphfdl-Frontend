//Audio
var aON = false;
var starttime = + new Date();

function changesound(el) {
	if (aON) {
		el.src = "src/audio-off.png";
		aON = false;
	} else {
		el.src = "src/audio-on.png";
		aON = true;
	}
}


//Main Map
var mainmap = L.map('mainmap',{fullscreenControl: {pseudoFullscreen: true}}).setView([49,11], 4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
//L.tileLayer('OSM/{z}/{x}/{y}.png', {
//	maxZoom: 8,
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(mainmap);
var mainmapmarkers = L.layerGroup().addTo(mainmap);


$('#details').on($.modal.BEFORE_BLOCK, function(a,b) {document.getElementById('mainmap').style.display = "none"});
$('#details').on($.modal.AFTER_CLOSE, function(a,b) {document.getElementById('mainmap').style.display = "block"});

//Live
var s = false;
function connectWS() {
	if (!document.getElementById('livex').checked) {
		return;
	}
	update_status(2);
	starttime = + new Date();
	s = new WebSocket("ws://"+window.location.hostname+":4561/");
	s.onopen = function(e) { update_status(1);console.log("WS opened"); }
	s.onclose = function(e) { update_status(0);console.log("WS closed");connectWS(); }
	s.onmessage = buildRow;
}
function update_status(s) {
	var el = document.getElementById('statusout');
	if (s == 0) {
		el.innerHTML = "Not connected";
		el.style.color = "red";
		return;
	}
	if (s == 1) {
		el.innerHTML = "Connected";
		el.style.color = "green";
		return;
	}
	if (s == 2) {
		el.innerHTML = "Connecting...";
		el.style.color = "orange";
		return;
	}
	if (s == "s") {
		el.innerHTML = "History";
		el.style.color = "gray";
	}
}

//General
var id = 0;
function break_long(text) {
	if (!text) {
		return text;
	}
	var parts = text.match(/.{1,50}/g);
	if (!parts) {
		return text;
	}
	return parts.join('<br>');
}
function detree(d,tree) {
	var keys = tree.split('/');
	var sub_d = d;
	for (i in keys) {
		var k = keys[i];
		if (typeof sub_d != 'object' || !(k in sub_d)) {
			return "";
		}
		sub_d = sub_d[k];
	}
	return sub_d;
}
function snn(e) {
	for (var i = 0; i < e.length; i++) {
		if (e[i]) {
			return e[i];
		}
	}
	return "";
}
function formatTime(t) {
	var t = new Date(t*1000);

	var d = t.getDate();
	var o = t.getMonth()+1;
	var y = t.getFullYear();

	var h = t.getHours();
	var m = t.getMinutes();
	var s = t.getSeconds();

	if (d < 10) {d = "0"+String(d);} else {	d = String(d);}
	if (o < 10) {o = "0"+String(o);} else { o = String(o);}
	y = String(y-2000);

	if (h < 10) {h = "0"+String(h);} else { h = String(h);}
	if (m < 10) {m = "0"+String(m);} else { m = String(m);}
	if (s < 10) {s = "0"+String(s);} else { s = String(s);}

	return d+"."+o+"."+y+" - "+h+":"+m+":"+s;
}
function buildRow(e) {
	id += 1;
	var msgid = "msg"+String(id);

	//Stats
	document.getElementById('stats_total').innerHTML = String(id).padStart(4);
	if (document.getElementById('livex').checked) {
		var rate = (id*60*1000) / ((+ new Date()) - starttime);
		document.getElementById('stats_rate').innerHTML = rate.toFixed(0).padStart(4);
	} else {
		document.getElementById('stats_rate').innerHTML = "----";
	}

	if (aON) {
		document.getElementById('bp').play();
	}

	var table = document.getElementById("maintab");
	var row = table.insertRow(1);
	row.classList.add('datarow');
	row.id = msgid;

	var d = JSON.parse(e.data);
	row.onclick = function() {showDetails(d);}

	buildInfoRow(d,row,msgid);
}
function validate_position(lat,lon) {
	if (lat < -90 || lat > 90) {
		console.log('Invalid Position (Lat)!');
		return false;
	}
	if (lon < -180 || lon > 180) {
		console.log('Invalid Position! (Lon)');
		return false;
	}
	return [lat,lon];
}
function get_position(d) {
	//in HFNPDU
	var pos1 = detree(d, 'hfdl/lpdu/hfnpdu/pos')
	if (pos1) {
		return validate_position(pos1.lat,pos1.lon);
	}
	//in VDL Params (find ac_location)
	var pps = detree(d, 'vdl2/avlc/xid/vdl_params')
	if (pps) {
		for (var i = pps.length - 1; i >= 0; i--) {
			var pp = pps[i];
			if (pp.name != "ac_location") {continue;}
			if (!pp.value.loc || !pp.value.loc.lat || !pp.value.loc.lon) {continue;}
			return validate_position(pp.value.loc.lat,pp.value.loc.lon);
		}
	}
	//libacars (find basic_report)
	var tags_section = snn([
		detree(d, 'hfdl/lpdu/hfnpdu/acars/arinc622/adsc/tags'),
		detree(d, 'vdl2/avlc/acars/arinc622/adsc/tags')
		]);
	if (tags_section) {
		for (var i = tags_section.length - 1; i >= 0; i--) {
			var tag = tags_section[i];
			if (! tag.hasOwnProperty('basic_report')) { continue;}
			if (!tag.basic_report.lat || !tag.basic_report.lon) {continue;}
			return validate_position(tag.basic_report.lat,tag.basic_report.lon);
		}
	}
	//adsv2
	pos = detree(d, 'vdl2/avlc/x25/clnp/cotp/adsc_v2/adsc_report/data/periodic_report/report_data/position')
	if (!pos) {
		pos = detree(d,'vdl2/avlc/x25/clnp/cotp/adsc_v2/adsc_report/data/event_report/report_data/position')
	}
	if (!pos) {
		pos = detree(d,'vdl2/avlc/x25/clnp/cotp/x225_spdu/x227_apdu/adsc_v2/adsc_report/data/periodic_report/report_data/position')
	}
	if (!pos) {
		pos = detree(d,'vdl2/avlc/x25/clnp/cotp/x225_spdu/x227_apdu/adsc_v2/adsc_report/data/event_report/report_data/position')
	}
	if (!pos) {
		pos = detree(d,'vdl2/avlc/x25/clnp/cptp/x225_spdu/x227_apdu/context_mgmt/cm_aircraft_message/data/atn_context_mgmt_logon_request/adsc_v2/adsc_report/data/periodic_report/report_data/position')
	}
	if (pos) {
		lat  = pos['lat']['deg']
		lat += pos['lat']['min'] / 60
		lat += pos['lat']['sec'] / 3600
		if (pos['lat']['dir'] == 'south') {
			lat *= -1
		}
		lon  = pos['lon']['deg']
		lon += pos['lon']['min'] / 60
		lon += pos['lon']['sec'] / 3600
		if (pos['lon']['dir'] == 'west') {
			lon *= -1
		}
		return validate_position(lat,lon)
	}
	return false;
}
function get_addresses(d) {
	var src_addr = snn([
		detree(d, 'vdl2/avlc/src/addr'),
		detree(d, 'hfdl/lpdu/src/ac_info/icao'),
		detree(d, 'hfdl/spdu/src/ac_info/icao'),
		detree(d, 'hfdl/mpdu/src/ac_info/icao'),
		detree(d, 'hfdl/lpdu/src/id'),
		detree(d, 'hfdl/spdu/src/id'),
		detree(d, 'hfdl/mpdu/src/id')
		]);
	var src_type = snn([
		detree(d, 'vdl2/avlc/src/type'),
		detree(d, 'hfdl/lpdu/src/type'),
		detree(d, 'hfdl/spdu/src/type'),
		detree(d, 'hfdl/mpdu/src/type')
		]);
	var src_name = snn([
		detree(d, 'hfdl/lpdu/src/name'),
		detree(d, 'hfdl/spdu/src/name'),
		detree(d, 'hfdl/mpdu/src/name')
		]);
	var dst_addr = snn([
		detree(d, 'vdl2/avlc/dst/addr'),
		detree(d, 'hfdl/lpdu/dst/ac_info/icao'),
		detree(d, 'hfdl/spdu/dst/ac_info/icao'),
		detree(d, 'hfdl/mpdu/dst/ac_info/icao'),
		detree(d, 'hfdl/lpdu/dst/id'),
		detree(d, 'hfdl/spdu/dst/id'),
		detree(d, 'hfdl/mpdu/dst/id')
		]);
	var dst_type = snn([
		detree(d, 'vdl2/avlc/dst/type'),
		detree(d, 'hfdl/lpdu/dst/type'),
		detree(d, 'hfdl/spdu/dst/type'),
		detree(d, 'hfdl/mpdu/dst/type')
		]);
	var dst_name = snn([
		detree(d, 'hfdl/lpdu/dst/name'),
		detree(d, 'hfdl/spdu/dst/name'),
		detree(d, 'hfdl/mpdu/dst/name')
		]);

	//Multiple Dsts
	var dsts = detree(d, 'hfdl/mpdu/dsts');
	var dsts_icaos = []
	if (dsts) {
		for (var i = 0; i < dsts.length; i++) {
			if (dsts[i].dst.hasOwnProperty('ac_info')) {
				dsts_icaos.push(dsts[i].dst.ac_info.icao);
			} else {
				dsts_icaos.push(dsts[i].dst.id);
			}
		}
		dst_addr = dsts_icaos.join(', ');
		dst_type = 'Aircraft';
	}


	if (src_type == 'Aircraft') {
		src_addr = snn([detree(d,'hfdl/lpdu/ac_info/icao'),src_addr]);
		src_addr += ' <img class="diricon" src="src/aircraft.png">'
	}
	if (src_type == 'Ground station') {
		if (src_addr.length == 6 && d.hasOwnProperty('vdl2') && vdl2_gs.hasOwnProperty(src_addr)) {
			var src_name = vdl2_gs[src_addr];
		}
		src_addr += ' <img class="diricon" src="src/ground.png">'
		if (src_name) {src_addr += ' ('+src_name+')';}
	}
	if (dst_type == 'Aircraft') {
		dst_addr = snn([detree(d,'hfdl/lpdu/ac_info/icao'),dst_addr]);
		dst_addr += ' <img class="diricon" src="src/aircraft.png">'
	}
	if (dst_type == 'Ground station') {
		if (dst_addr.length == 6 && d.hasOwnProperty('vdl2') && vdl2_gs.hasOwnProperty(dst_addr)) {
			var dst_name = vdl2_gs[dst_addr];
		}
		dst_addr += ' <img class="diricon" src="src/ground.png">'
		if (dst_name) {dst_addr += ' ('+dst_name+')';}
	}
	return [src_addr,dst_addr];
}
function get_type(d) {
	var type = "UNKNOWN";
	var color = "#ffffff";
	if (d.hasOwnProperty('vdl2')) {
		var data = d.vdl2.avlc;
		if (data.hasOwnProperty('acars')) {
			color = "#ffcc99";
			type = 'ACARS';
			return [type,color];
		}
		if (data.hasOwnProperty('xid')) {
			color = "#00ccff";
			type = "XID";
			return [type,color];
		}
		if (data.hasOwnProperty('x25')) {
			color = "#99ccff";
			type = "X25: "+get_x25_type(d);
			return [type,color];
		}
		if ("cmd" in data) {
			color = "#cc6699";
			type = "Command: "+data.cmd;
			return [type,color];
		}
	}
	if (d.hasOwnProperty('hfdl')) {
		var data = d.hfdl;
		if (data.hasOwnProperty('mpdu')) {
			color = "#ffccff";
			type = 'MPDU';
			return [type,color];
		}
		if (data.hasOwnProperty('spdu')) {
			color = "#ccff99";
			type = 'SPDU';
			return [type,color];
		}
		if (data.hasOwnProperty('lpdu')) {
			if (data.lpdu.hasOwnProperty('hfnpdu')) {
				type = data.lpdu.hfnpdu.type.name;
				color = "#99ccff";
				type = "HFNPDU / "+type;
				return [type,color];
			}
			color = "#ffff99";
			type = 'LPDU / '+data.lpdu.type.name;
			return [type,color];
		}
	}
	return [type,color];
}
function buildInfoRow(d,el,msgid=false) {
	//Row vars
	var ts = snn([detree(d, 'hfdl/t/sec'),detree(d, 'vdl2/t/sec')]);
	var f_hz = snn([detree(d, 'hfdl/freq'),detree(d,'vdl2/freq')]);
	var slvl = snn([detree(d, 'hfdl/sig_level'),detree(d,'hfdl/sig_level')]);
	var nlvl = snn([detree(d, 'hfdl/noise_level'),detree(d,'vdl2/noise_level')]);
	var addrs = get_addresses(d);
	var flight = snn([detree(d,'vdl2/avlc/acars/flight'),detree(d,'hfdl/lpdu/hfnpdu/flight_id'),detree(d,'hfdl/lpdu/hfnpdu/acars/flight'),detree(d,'vdl2/avlc/x25/clnp/cptp/x225_spdu/x227_apdu/context_mgmt/cm_aircraft_message/data/atn_context_mgmt_logon_request/flight_id')]);
	var reg = snn([detree(d,'hfdl/lpdu/hfnpdu/acars/reg'),detree(d,'vdl2/avlc/acars/reg')]);
	if (reg) {reg = reg.replace(".","")}

	//Distinct Msg Type
	var type_color = get_type(d);
	type = type_color[0];
	el.style.backgroundColor = type_color[1];

	//Build row
	var html = "<td>"+formatTime(ts)+"</td>";
	html += "<td>"+(f_hz/1e6).toFixed(3)+"</td>";
	html += "<td>"+type+"</td>";
	html += "<td>"+(slvl-nlvl).toFixed(2)+"</td>";
	html += "<td>"+addrs[0]+"</td>";
	html += "<td>"+addrs[1]+"</td>";
	html += "<td>"+flight+"</td>";
	html += "<td>"+reg+"</td>";

	//Position and ACARS Flags
	var pos = get_position(d);
	var msgtext = snn([detree(d, 'hfdl/lpdu/hfnpdu/acars/msg_text'),detree(d, 'vdl2/avlc/acars/msg_text')]);
	var lacars = snn([
		detree(d,'hfdl/lpdu/hfnpdu/acars/arinc622'),
		detree(d,'hfdl/lpdu/hfnpdu/acars/miam'),
		detree(d,'hfdl/lpdu/hfnpdu/acars/media-adv'),
		detree(d,'vdl2/avlc/acars/arinc622'),
		detree(d,'vdl2/avlc/acars/miam'),
		detree(d,'vdl2/avlc/acars/media-adv')
		]);
	if (pos) {
		html += '<td><img src="src/lib/images/marker-icon.png" alt="+" style="width: 18px;"></td>';
		if (msgid) {
			L.marker(pos).addTo(mainmapmarkers).on('click', function(e) {
				document.getElementById(msgid).click();
			});
		}
	} else if (lacars) {
		html += '<td><img src="src/lacars.png" alt="MSG" style="width 26px;"></td>';
	} else if (msgtext && msgtext != "") {
		html += '<td><img src="src/text.png" alt="TXT" style="width: 26px;"></td>';
	} else {
		html += '<td></td>';
	}

	el.innerHTML = html;
}
function showDetails(d) {
	var modal_container = document.getElementById('details');
	modal_container.innerHTML = "";

	//Info Table
	modal_container.innerHTML += '<table class="det_head"><tbody><tr class="outtabhead"><th>Timestamp</th><th>Frequency</th><th>Type</th><th>SNR</th><th>SRC Addr</th><th>DST Addr</th><th>Flight</th><th>Reg</th><th></th></tr><tr id="det_head_line"></tr></table>'
	var dhl = document.getElementById('det_head_line');
	buildInfoRow(d,dhl);

	//Prepare Table structure
	var type_color = get_type(d);
	modal_container.innerHTML += '<h2>'+type_color[0]+'</h2><div id="outbox"></div><hr><details id="rawjsonout"><summary>Raw data</summary></details>';

	//Table stuff
	var outbox = document.getElementById('outbox');
	detailTables(outbox,d);

	//JSON out
	var rawjsonout = document.getElementById('rawjsonout');
	buildTree(rawjsonout,d);

	$('#details').modal();
}

//Detail Tables
function detailTables(el,d) {
	//HFDL
	if (detree(d,'hfdl/mpdu')) {
		show_mpdu(d,el);
	}
	if (detree(d,'hfdl/spdu')) {
		show_spdu(d,el);
	}
	if (detree(d,'hfdl/spdu/gs_status')) {
		spdu_freq_tab(d,el);
	}
	if (detree(d,'hfdl/lpdu')) {
		show_lpdu(d,el);
	}
	if (detree(d,'hfdl/lpdu/hfnpdu')) {
		show_hfnpdu(d,el);
		hfnpdu_tab(d,el);
	}

	//VDL2
	if (d.hasOwnProperty('vdl2')) {
		show_vdl2(d,el);
	}
	if (detree(d,'vdl2/avlc/acars')) {
		show_vdl2_acars(d,el);
	}
	if (detree(d,'vdl2/avlc/xid')) {
		show_vdl2_xid(d,el);
	}
	if (detree(d,'vdl2/avlc/x25')) {
		show_vdl2_x25(d,el);
	}

	//libacars
	var m_adv = snn([detree(d,'hfdl/lpdu/hfnpdu/acars/media-adv'),detree(d,'vdl2/avlc/acars/media-adv')]);
	if (m_adv) {
		show_libacars_media_adv(m_adv,el);
	}
	var m_miam = snn([detree(d,'hfdl/lpdu/hfnpdu/acars/miam'),detree(d,'vdl2/avlc/acars/miam')]);
	if (m_miam) {
		show_libacars_miam(m_miam,el);
	}
	var m_arinc = snn([detree(d,'hfdl/lpdu/hfnpdu/acars/arinc622'),detree(d,'vdl2/avlc/acars/arinc622')]);
	if (m_arinc) {
		show_libacars_arinc(m_arinc,el);
	}

	pos = get_position(d);
	if (pos) {
		el.innerHTML += '<div id="posmap"></div>';
		var map = L.map('posmap',{fullscreenControl: {pseudoFullscreen: true}}).setView(pos, 4);
		L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
		//L.tileLayer('OSM/{z}/{x}/{y}.png', {
		//	maxZoom: 8,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);
		L.marker(pos).addTo(map);
		window.setTimeout(function() {map.invalidateSize();}, 500);
	}
}
function show_mpdu(d,el) {
	var src_d = d.hfdl.mpdu.src;
	var dst_d = d.hfdl.mpdu.dsts;

	if (dst_d == undefined) {
		dst_d = [d.hfdl.mpdu];
	}

	if (src_d.type) {stype = src_d.type;} else {stype = "";}
	if (src_d.id) {sid = src_d.id;} else {sid = "";}
	if (src_d.ac_info) {sid += ' / <a href="https://globe.adsbexchange.com/?icao='+src_d.ac_info.icao+'">'+src_d.ac_info.icao+'</a>';}
	if (src_d.name) {sid += " ("+src_d.name+")";}

	var html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">SRC</th></tr><tr><th>Type</th><th>ID</th></tr>'
	html += '<tr><td>'+stype+'</td><td>'+sid+'</td></tr>';
	html += '</table></div>';

	html += '<table class="outtabs"><tr><th colspan="4" class="outtabhead">DST</th></tr><tr><th>Type</th><th>ID</th><th>LPDU Count</th></tr>';

	for (var i = dst_d.length - 1; i >= 0; i--) {
		var dstx = dst_d[i];
		if (dstx.dst.type) {xtype = dstx.dst.type;} else {xtype = "";}
		if (dstx.dst.id) {xid = dstx.dst.id;} else {xid = "";}
		if (dstx.lpdu_cnt) {xcnt = dstx.lpdu_cnt;} else {xcnt = "";}
		if (dstx.dst.name) {xid += " ("+dstx.dst.name+")";}
		if (dstx.dst.ac_info) {xid += ' (<a target="_blank" href="https://globe.adsbexchange.com/?icao='+dstx.dst.ac_info.icao+'">'+dstx.dst.ac_info.icao+'</a>)';}
		html += '<tr><td>'+xtype+'</td><td>'+xid+'</td><td>'+xcnt+'</td></tr>';
	}
	html += '</table>';

	el.innerHTML += html;
}
function show_spdu(d,el) {
	src_id   = detree(d,'hfdl/spdu/src/id');
	src_name = detree(d,'hfdl/spdu/name');
	systbv   = detree(d,'hfdl/spdu/systable_version');
	cnote    = detree(d,'hfdl/spdu/change_note');
	if (src_name) {src_id += " ("+String(src_name)+")";}

	var html = '<table class="outtabs">';
	html += '<tr><th colspan="2" class="outtabhead">SPDU</th></tr>';
	html += '<tr><th>SRC ID</th><td>'+src_id+'</td></tr>';
	html += '<tr><th>Systable Version</th><td>'+systbv+'</td></tr>';
	html += '<tr><th>Change Note</th><td>'+cnote+'</td></tr>';
	html += '</table>';

	el.innerHTML += html;
}
function spdu_freq_tab(d,el) {
	gss = detree(d,'hfdl/spdu/gs_status');
	var html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">GS Status</th></tr><tr><th>Ground Station</th><th>UTC Sync</th><th>Freqs</th></tr>';
	for (var i = gss.length - 1; i >= 0; i--) {
		var gs = gss[i];

		var gsid = gs.gs.id;
		var gsna = gs.gs.name;
		var utcs = gs.utc_sync;
		html += '<tr><td>'+String(gsid)+" ("+gsna+")"+"</td><td>"+String(utcs)+'</td><td style="text-align: left;">'+spdu_gs_freqlist(gs)+"</td></tr>";
	}
	html += '</table>'
	el.innerHTML += html;
}
function show_lpdu(d,el) {
	src_type = detree(d,'hfdl/lpdu/src/type');
	dst_type = detree(d,'hfdl/lpdu/dst/type');
	src_id   = detree(d,'hfdl/lpdu/src/id');
	dst_id   = detree(d,'hfdl/lpdu/dst/id');
	src_name = detree(d,'hfdl/lpdu/src/name');
	dst_name = detree(d,'hfdl/lpdu/dst/name');
	lpdu_typ = detree(d,'hfdl/lpdu/type/name');
	icao     = snn([detree(d,'hfdl/lpdu/ac_info/icao'),detree(d,'hfdl/lpdu/src/ac_info/icao'),detree(d,'hfdl/lpdu/dst/ac_info/icao')]);
	aacid    = detree(d,'hfdl/lpdu/assigned_ac_id');

	if (src_name) {src_id += " ("+String(src_name)+")";}
	if (dst_name) {dst_id += " ("+String(dst_name)+")";}
	if (lpdu_typ) {var lptype = lpdu_typ} else {var lptype = "unknown"}

	var html = '<table class="outtabs"><tr><th colspan="2" class="outtabhead">LPDU ('+lptype+')</th><tr>';
	html += '<tr><th>Dir</th><td>'+src_type+' ⇨ '+dst_type+'</td></tr>';
	html += '<tr><th>SRC ID</th><td>'+src_id+'</td></tr>';
	html += '<tr><th>DST ID</th><td>'+dst_id+'</td></tr>';
	html += '<tr><th>Type</th><td>'+lptype+'</td></tr>';
	if (icao) {html += '<tr><th>ICAO</th><td><a target="_blank" href="https://globe.adsbexchange.com/?icao='+icao+'">'+icao+'</a></td></tr>';}
	if (aacid) {html += '<tr><th>Assigned AC ID</th><td>'+String(aacid)+'</td></tr>'}
	html += '</table>';

	el.innerHTML += html;
}
function show_hfnpdu(d,el) {
	var hftype = detree(d,'hfdl/lpdu/hfnpdu/type/name');
	var fid    = detree(d,'hfdl/lpdu/hfnpdu/flight_id')
	var pos    = detree(d,'hfdl/lpdu/hfnpdu/pos')
	var err    = detree(d,'hfdl/lpdu/hfnpdu/err')
	if (!hftype) {var hftype = "unknown"}

	var html = '<table class="outtabs"><tr><th colspan="2" class="outtabhead">HFNPDU ('+hftype+')</th><tr>';
	html += '<tr><th>Type</th><td>'+hftype+'</td></tr>';
	if (err) {html += '<tr><th>Error</th><td>'+err+'</td></tr>';}
	if (fid) {html += '<tr><th>Flight ID</th><td>'+fid+'</td></tr>';}
	if (pos) {
		html += '<tr><th>Position</th><td>'+String(pos.lat)+', '+String(pos.lon)+'</td></tr></table>';
	} else {
		html += '</table>';
	}

	el.innerHTML += html;
}
function hfnpdu_tab(d,el) {
	var hftype = detree(d,'hfdl/lpdu/hfnpdu/type/name');
	if (hftype == "Enveloped data") {
		data = d.hfdl.lpdu.hfnpdu.acars;

		var html = '<table class="outtabs"><tr><th colspan="2" class="outtabhead">Enveloped data</th><tr>';
		if (data.err) {html +=  '<tr><th>Error</th><td>'+String(data.err)+'</td></tr>';}
		if (data.crc_ok) {html +=  '<tr><th>CRC OK</th><td>'+String(data.crc_ok)+'</td></tr>';}
		if (data.more) {html +=  '<tr><th>More</th><td>'+String(data.more)+'</td></tr>';}
		if (data.reg) {html +=  '<tr><th>Reg</th><td>'+String(data.reg)+'</td></tr>';}
		if (data.mode) {html +=  '<tr><th>Mode</th><td>'+String(data.mode)+'</td></tr>';}
		if (data.label) {html +=  '<tr><th>Label</th><td>'+String(data.label)+'</td></tr>';}
		if (data.blk_id) {html +=  '<tr><th>BLK ID</th><td>'+String(data.blk_id)+'</td></tr>';}
		if (data.ack) {html +=  '<tr><th>ACK</th><td>'+String(data.ack)+'</td></tr>';}
		if (data.flight) {html +=  '<tr><th>Flight</th><td>'+String(data.flight)+'</td></tr>';}
		if (data.msg_num) {html +=  '<tr><th>Msg Num</th><td>'+String(data.msg_num)+'</td></tr>';}
		if (data.msg_num_seq) {html +=  '<tr><th>Msg Num Seq</th><td>'+String(data.msg_num_seq)+'</td></tr>';}
		html +=  '<tr><th>Text</th><td>'+break_long(String(data.msg_text))+'</td></tr>';
		html += '</table>';
		el.innerHTML += html;
	}
	if (hftype == "Performance data") {
		data = d.hfdl.lpdu.hfnpdu;
		var gss = String(data.gs.id);
		if (data.gs.name) {gss += " ("+data.gs.name+")";}
		var hdcl = detree(data,'hfdl_disabled_duration/cur_leg')
		var hdpl = detree(data,'hfdl_disabled_duration/prev_leg')

		var html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">Performance data</th><tr>';
		html +=  '<tr><th>Flight Leg</th><td colspan="2">'+String(data.flight_leg_num)+'</td></tr>';
		html +=  '<tr><th>Last Freq Change Cause</th><td colspan="2">'+data.last_freq_change_cause.descr+'</td></tr>';
		html +=  '<tr><th></th><td>Curr Leg</td><td>Prev Leg</td></tr>';
		html +=  '<tr><th>Freq Search Count</th><td>'+String(data.freq_search_cnt.cur_leg)+'</td><td>'+String(data.freq_search_cnt.prev_leg)+'</td></tr>';
		html +=  '<tr><th>HFDL Disabled Duration</th><td>'+hdcl+'</td><td>'+hdpl+'</td></tr>';
		html += '</table>';

		html += '<table class="outtabs"><tr><th colspan="5" class="outtabhead">PDU Stats</th><tr>';
		html +=  '<tr><th>BPS Speed</th><td>300</td><td>600</td><td>1200</td><td>1800</td></tr>';
		html +=  '<tr><th>MPDUs RX OK</th>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_ok_cnt/300bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_ok_cnt/600bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_ok_cnt/1200bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_ok_cnt/1800bps'))+'</td>';
		html +=  '</tr><tr><th>MPDUs RX Error</th>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_err_cnt/300bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_err_cnt/600bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_err_cnt/1200bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_rx_err_cnt/1800bps'))+'</td>';
		html +=  '</tr><tr><th>MPDUs TX</th>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_tx_cnt/300bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_tx_cnt/600bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_tx_cnt/1200bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_tx_cnt/1800bps'))+'</td>';
		html +=  '</tr><tr><th>MPDUs Delivered</th>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_delivered_cnt/300bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_delivered_cnt/600bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_delivered_cnt/1200bps'))+'</td>';
		html +=  '<td>'+String(detree(data,'pdu_stats/mpdus_delivered_cnt/1800bps'))+'</td>';
		html +=  '</tr><tr><th>SPDUs RX OK</th><td colspan="4">'+String(detree(data,'pdu_stats/spdus_rx_ok_cnt'))+'</td><tr>';
		html +=  '</tr><tr><th>SPDUs Missed</th><td colspan="4">'+String(detree(data,'pdu_stats/spdus_missed_cnt'))+'</td><tr>';
		html +=  '</table>';

		el.innerHTML += html;
	}
	if (hftype == "Frequency data") {
		data = d.hfdl.lpdu.hfnpdu.freq_data;
		var html = '<table class="outtabs"><tr><th colspan="2" class="outtabhead">Frequency data</th><tr>';
		if (data.length == 0) {
			html +='<tr><td colspan="2">Empty</td></tr></table>';
		} else {
			for (var i = data.length - 1; i >= 0; i--) {
				var g = data[i];
				html += '<tr><th>Ground Station</th><th>'+g.gs.id
				if (g.gs.name) {html += ' ('+g.gs.name+')';}
				html += '</th></tr>';
				html += '<tr><th>Frequencies Listening</th><td>'+fd_list_freq(g.listening_on_freqs)+'</td></tr>';
				html += '<tr><th>Frequencies Heard on</th><td>'+fd_list_freq(g.heard_on_freqs)+'</td></tr>';
			}
			html += '</table>';
		}


		el.innerHTML += html;
	}
	if (hftype == "System table (partial)") {
		var data = d.hfdl.lpdu.hfnpdu;
		var html = '<table class="outtabs"><tr><th colspan="2" class="outtabhead">System table (partial)</th><tr>';
		html += '<tr><th>System Table Version</th><td>'+String(data.version)+'</td></tr>';
		html += '<tr><th>Part No</th><td>'+String(data.systable_partial.part_num)+'</td></tr>';
		html += '<tr><th>Parts Total</th><td>'+String(data.systable_partial.parts_cnt)+'</td></tr>';
		html += '</table>';

		el.innerHTML += html;
	}
}
function show_vdl2(d,el) {
	var src_addr = String(d.vdl2.avlc.src.addr);
	var src_st = "";
	if (d.vdl2.avlc.src.type) {src_st += " ("+d.vdl2.avlc.src.type+")";}
	if (d.vdl2.avlc.src.status) {src_st += " ("+d.vdl2.avlc.src.status+")";}

	var dst_addr = String(d.vdl2.avlc.dst.addr);
	var dst_st = "";
	if (d.vdl2.avlc.dst.type) {dst_st += " ("+d.vdl2.avlc.dst.type+")";}
	if (d.vdl2.avlc.dst.status) {dst_st += " ("+d.vdl2.avlc.dst.status+")";}

	var html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">VDL2</th></tr>';
	html += '<tr><th>Burst Len</th><td>'+String(d.vdl2.burst_len_octets)+'</td></tr>';
	html += '<tr><th>HDR Bits fixed</th><td>'+String(d.vdl2.hdr_bits_fixed)+'</td></tr>';
	html += '<tr><th>FEC corrected octets</th><td>'+String(d.vdl2.octets_corrected_by_fec)+'</td></tr>';
	html += '<tr><th>IDX</th><td>'+String(d.vdl2.idx)+'</td></tr>';

	html += '<tr><th colspan="2">AVLC</th></tr>';
	html += '<tr><th>SRC Addr</th><td><a target="_blank" href="https://globe.adsbexchange.com/?icao='+src_addr+'">'+src_addr+'</a>'+src_st+'</td></tr>';
	html += '<tr><th>DST Addr</th><td><a target="_blank" href="https://globe.adsbexchange.com/?icao='+dst_addr+'">'+dst_addr+'</a>'+dst_st+'</td></tr>';
	if (d.vdl2.avlc.cr) {html += '<tr><th>C/R</th><td>'+d.vdl2.avlc.cr+'</td></tr>';}
	if (d.vdl2.avlc.cmd) {html += '<tr><th>CMD</th><td>'+d.vdl2.avlc.cmd+'</td></tr>';}
	if (d.vdl2.frame_type) {html += '<tr><th>Frame Type</th><td>'+d.vdl2.frame_type+'</td></tr>';}
	if (d.vdl2.avlc.hasOwnProperty('pf')) {html += '<tr><th>P/F</th><td>'+d.vdl2.avlc.pf+'</td></tr>';}
	if (d.vdl2.avlc.hasOwnProperty('rseq')) {html += '<tr><th>RSEQ</th><td>'+d.vdl2.avlc.rseq+'</td></tr>';}
	if (d.vdl2.avlc.hasOwnProperty('sseq')) {html += '<tr><th>SSEQ</th><td>'+d.vdl2.avlc.sseq+'</td></tr>';}
	if (d.vdl2.avlc.hasOwnProperty('poll')) {html += '<tr><th>Poll</th><td>'+d.vdl2.avlc.poll+'</td></tr>';}
	html += '</table>';

	el.innerHTML += html;
}
function show_vdl2_acars(d,el) {
	var data = d.vdl2.avlc.acars;
	var html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">ACARS</th></tr>';

	if (data.hasOwnProperty('err')) {html += '<tr><th>Error</th><td>'+String(data.err)+'</td></tr>';}
	if (data.hasOwnProperty('crc_ok')) {html += '<tr><th>CRC OK</th><td>'+String(data.crc_ok)+'</td></tr>';}
	if (data.hasOwnProperty('more')) {html += '<tr><th>More</th><td>'+String(data.more)+'</td></tr>';}
	if (data.hasOwnProperty('reg')) {html += '<tr><th>Reg</th><td>'+String(data.reg)+'</td></tr>';}
	if (data.hasOwnProperty('mode')) {html += '<tr><th>Mode</th><td>'+String(data.mode)+'</td></tr>';}
	if (data.hasOwnProperty('label')) {html += '<tr><th>Label</th><td>'+String(data.label)+'</td></tr>';}
	if (data.hasOwnProperty('sublabel')) {html += '<tr><th>Sublabel</th><td>'+String(data.sublabel)+'</td></tr>';}
	if (data.hasOwnProperty('mfi')) {html += '<tr><th>MFI</th><td>'+String(data.mfi)+'</td></tr>';}
	if (data.hasOwnProperty('blk_id')) {html += '<tr><th>BLK ID</th><td>'+String(data.blk_id)+'</td></tr>';}
	if (data.hasOwnProperty('ack')) {html += '<tr><th>ACK</th><td>'+String(data.ack)+'</td></tr>';}
	if (data.hasOwnProperty('flight')) {html += '<tr><th>Flight</th><td>'+String(data.flight)+'</td></tr>';}
	if (data.hasOwnProperty('msg_num')) {html += '<tr><th>MSG Num</th><td>'+String(data.msg_num)+'</td></tr>';}
	if (data.hasOwnProperty('msg_num_seq')) {html += '<tr><th>MSG Num Seq</th><td>'+String(data.msg_num_seq)+'</td></tr>';}
	if (data.hasOwnProperty('msg_text')) {html += '<tr><th>Text</th><td>'+break_long(String(data.msg_text))+'</td></tr>';}
	html += '</table>';

	el.innerHTML += html;
}
function show_vdl2_xid(d,el) {
	var data = d.vdl2.avlc.xid;
	var html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">XID';
	if (data.type_descr) {
		html += " - "+data.type_descr;
	}
	html += '</th></tr>';
	if ('pub_params' in data) {
		html += '<tr><th colspan="2">Public Parameter</th></tr>';
		for (var i = 0; i < data.pub_params.length; i++) {
			var pp = data.pub_params[i];
			var name = xid_param_lookup[pp.name];
			if (typeof pp.value == 'object') {
				var value = pp.value.join(', ');
			} else {
				var value = pp.value;
			}
			html += '<tr><th>'+name+'</th><td>'+value+'</td></tr>';
		}
	}
	if ('vdl_params' in data) {
		html += '<tr><th colspan="2">VDL2 Parameter</th></tr>';
		for (var i = 0; i < data.vdl_params.length; i++) {
			var pp = data.vdl_params[i];
			var name = xid_param_lookup[pp.name];
			if (pp.name == 'ac_location') {
				var value = String(pp.value.loc.lat)+", "+String(pp.value.loc.lon);
			} else if (typeof pp.value == 'object' && pp.value.length) {
				//List
				var value = pp.value.join(', ');
			} else if (typeof pp.value == 'object') {
				//Object
				var v = [];
				for (k in pp.value) {
					v.push(String(k)+": "+String(pp.value[k]));
				}
				var value = v.join(', ');
			} else {
				//Other
				var value = pp.value;
			}
			html += '<tr><th>'+name+'</th><td>'+value+'</td></tr>';
		}
	}
	html += '</table>';

	el.innerHTML += html;
}

//X25 is not handy!!!---------------
function show_vdl2_x25(d,el) {
	var data = d.vdl2.avlc.x25;
	var x25_type = detree(data,'pkt_type_name');
	if (x25_type) {
		x25_type = " - "+x25_type;
	}
	var html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">X25'+x25_type+'</th></tr>';

	//Check for interesting content
	fl_id   = detree(data,'clnp/cptp/x225_spdu/x227_apdu/context_mgmt/cm_aircraft_message/data/atn_context_mgmt_logon_request/flight_id');
	dep_ap  = detree(data,'clnp/cptp/x225_spdu/x227_apdu/context_mgmt/cm_aircraft_message/data/atn_context_mgmt_logon_request/departure_airport');
	dest_ap = detree(data,'clnp/cptp/x225_spdu/x227_apdu/context_mgmt/cm_aircraft_message/data/atn_context_mgmt_logon_request/destination_airport');
	cpdlc   = snn([
		detree(data,'clnp/cotp/cpdlc'),
		detree(data,'clnp/cotp/x225_spdu/x227_apdu/cpdlc'),
		detree(data,'clnp/cotp/x227_apdu/cpdlc'),
		detree(data,'clnp/sndcf_error_report/clnp/cotp/cpdlc'),
		detree(data,'clnp/sndcf_error_report/clnp/cotp/x225_spdu/x227_apdu/cpdlc'),
		detree(data,'clnp/sndcf_error_report/clnp/cotp/x227_apdu/cpdlc')
	]);

	if (fl_id) { html += '<tr><th>Flight ID</th><td>'+fl_id+'</td></tr>';}
	if (dep_ap) { html += '<tr><th>Destination Airport</th><td>'+dep_ap+'</td></tr>';}
	if (dest_ap) { html += '<tr><th>Departure Airport</th><td>'+dest_ap+'</td></tr>';}


	//check err / compression / facilities
	if (data.hasOwnProperty('err')) {html += '<tr><th>Error</th><td>'+String(data.err)+'</td></tr>';}
	if (data.hasOwnProperty('compression_algos')) {html += '<tr><th>Compression Algos</th><td>'+data.compression_algos.join(', ')+'</td></tr>';}
	//Facilities
	if (data.hasOwnProperty('facilities')) {
		html += '<tr><th colspan="2">Facilities</th></tr>';
		for (var i = 0; i < data.facilities.length; i++) {
			var fac = data.facilities[i];
			if (x25_fac_lookup.hasOwnProperty(fac.name)) {
				var name = x25_fac_lookup[fac.name];
			} else {
				var name = fac.name;
			}
			if (typeof fac.value == 'object' && fac.value.length) {
				//List
				var value = fac.value.join(', ');
			} else if (typeof fac.value == 'object') {
				//Object
				var v = [];
				for (k in fac.value) {
					v.push(String(k)+": "+String(fac.value[k]));
				}
				var value = v.join(', ');
			} else {
				//Other
				var value = fac.value;
			}
			html += '<tr><td>'+name+'</td><td>'+value+'</td></tr>';
		}
	}

	//check which subpackets included
	html += getSubPack(data);

	html += '</table>';
	el.innerHTML += html;

	if (cpdlc && Object.keys(cpdlc).length != 0) {
		html = '<table class="outtabs"><tr><th colspan="3" class="outtabhead">CPDLC</th></tr>';
		html += cpdlc_tab(cpdlc);
		html += '</table>';
		el.innerHTML += html;
	}

	//ADSC stuff ----
	adsc_v2_tab(data,el);
}
function adsc_v2_tab(d,el) {
	report = snn([
		detree(d,'clnp/cotp/x225_spdu/x227_apdu/adsc_v2'),
		detree(d,'clnp/cotp/adsc_v2'),
		detree(d,'clnp/cptp/x225_spdu/x227_apdu/context_mgmt/cm_aircraft_message/data/atn_context_mgmt_logon_request/adsc_v2')
	]);
	if (!report) {
		return;
	}
	var html = "";
	//ACK
	if (report.hasOwnProperty('adsc_ack')) {
		html += '<table class="outtabs"><tr><th colspan="3" class="outtabhead">ADS-C v2 ACK</th></tr>';
		var rt = report['adsc_ack']['request_type'];
		var cn = report['adsc_ack']['contract_number'];

		if (rt == 'periodic-contract') {
			html += "<tr><th>Request Type</th><td>Periodic Contract</td></tr>";
		} else if (rt == 'event-contract') {
			html += "<tr><th>Request Type</th><td>Event Contract</td></tr>";
		} else if (rt == 'demand-contract') {
			html += "<tr><th>Request Type</th><td>Demand Contract</td></tr>";
		}
		if (cn) { html += '<tr><th>Contract Number</th><td>'+cn+'</td></th>'; }

		if ('connected_atsu_list' in report['adsc_ack']) {
			html += '<tr><th colspan="2">Connected ATSU</th></tr>';
			calist = report['adsc_ack']['connected_atsu_list'];
			if (calist['high_priority'] && typeof calist['high_priority'] == "string") {
				html += '<tr><th>High Priority</th><td>'+calist['high_priority']+'</td></th>';
			}
			if (calist['high_priority'] && typeof calist['high_priority'] == "object") {
				var list = [];
				for (var i = calist['high_priority'].length - 1; i >= 0; i--) {
					list.push(calist['high_priority'][i]['facility_designation']);
				}
				html += '<tr><th>High Priority</th><td>'+list.join(', ')+'</td></th>';
			}
			if (calist['medium_priority'] && typeof calist['medium_priority'] == "string") {
				html += '<tr><th>Medium Priority</th><td>'+calist['medium_priority']+'</td></th>';
			}
			if (calist['medium_priority'] && typeof calist['medium_priority'] == "object") {
				var list = [];
				for (var i = calist['medium_priority'].length - 1; i >= 0; i--) {
					list.push(calist['medium_priority'][i]['facility_designation']);
				}
				html += '<tr><th>Medium Priority</th><td>'+list.join(', ')+'</td></th>';
			}
			if (calist['low_priority'] && typeof calist['low_priority'] == "string") {
				html += '<tr><th>Low Priority</th><td>'+calist['low_priority']+'</td></th>';
			}
			if (calist['low_priority'] && typeof calist['low_priority'] == "object") {
				var list = [];
				for (var i = calist['low_priority'].length - 1; i >= 0; i--) {
					list.push(calist['low_priority'][i]['facility_designation']);
				}
				html += '<tr><th>Low Priority</th><td>'+list.join(', ')+'</td></th>';
			}
		}
		html += '</table>';
	}

	//ADS-C Report
	if (report.hasOwnProperty('adsc_report')) {
		html += '<table class="outtabs"><tr><th colspan="3" class="outtabhead">ADS-C v2 Report</th></tr>';
		var rt = report['adsc_report']['choice'];
		if (rt == 'periodic-report') {
			html += "<tr><th>Request Type</th><td>Periodic Report</td></tr>";
		} else if (rt == 'event-report') {
			html += "<tr><th>Request Type</th><td>Event Report</td></tr>";
		} else if (rt == 'demand-report') {
			html += "<tr><th>Request Type</th><td>Demand Report</td></tr>";
		}
		if (cn) { html += '<tr><th>Contract Number</th><td>'+cn+'</td></th>'; }

		//.-----
		var gtype = Object.keys(report['adsc_report']['data'])[0];
		var report_data = report['adsc_report']['data'][gtype]['report_data'];
		console.log(report_data);
		if (report_data.hasOwnProperty('timestamp')) {
			d = report_data['timestamp']['date']['day'];
			m = report_data['timestamp']['date']['month'];
			y = report_data['timestamp']['date']['year'];

			h = report_data['timestamp']['time']['hour'];
			i = report_data['timestamp']['time']['min'];
			s = report_data['timestamp']['time']['sec'];


			if (d < 10) {d = "0"+String(d);} else {d = String(d);}
			if (m < 10) {m = "0"+String(m);} else {m = String(m);}
			if (h < 10) {h = "0"+String(h);} else {h = String(h);}
			if (i < 10) {i = "0"+String(i);} else {i = String(i);}
			if (s < 10) {s = "0"+String(s);} else {s = String(s);}

			html += '<tr><th>Timestamp</th><td>'+d+'.'+m+'.'+h+' - '+h+':'+i+':'+s+'</td></th>';			
		}
		if (report_data.hasOwnProperty('timestamp')) {
			lat  = pos['lat']['deg']
			lat += pos['lat']['min'] / 60
			lat += pos['lat']['sec'] / 3600
			if (pos['lat']['dir'] == 'south') {
				lat *= -1
			}
			lon  = pos['lon']['deg']
			lon += pos['lon']['min'] / 60
			lon += pos['lon']['sec'] / 3600
			if (pos['lon']['dir'] == 'west') {
				lon *= -1
			}
			html += '<tr><th>Position</th><td>'+lat.toFixed(4)+', '+lon.toFixed(4)+'</td></th>';
		}
		//Position
		//...


		html += '</table>';
	}
	el.innerHTML += html;
}
function getSubPack(data) {
	if (!data.hasOwnProperty('clnp') && !data.hasOwnProperty('esis') && !data.hasOwnProperty('sndcf_error_report') && !data.hasOwnProperty('unknown_proto')) {
		return ""
	}
	html = '<tr><th colspan="2">Subpackets</th></tr>'

	var subpacks = [
		//Name,tree,typetree
		['CLNP','clnp','clnp/pdu_type_name'],
		['Unknown','clnp/unknown_proto',false],
		['IDRP','clnp/idrp','clnp/idrp/pdu_type_name'],
		['COTP','clnp/cotp','clnp/cotp/pdu_list'],
		['CPDLC','clnp/cotp/cpdlc',false],
		['Unknown','clnp/cotp/unknown_proto',false],
		['ADS-C v2','clnp/cotp/adsc_v2'],
		['X225 SPDU','clnp/cotp/x225_spdu','clnp/cotp/x225_spdu/spdu_type'],
		['X227 APDU','clnp/cotp/x225_spdu/x227_apdu',false],
		['CPDLC','clnp/cotp/x225_spdu/x227_apdu/cpdlc',false],
		['X227 APDU','clnp/cotp/x227_apdu',false],
		['CPDLC','clnp/cotp/x227_apdu/cpdlc',false],
		['ESIS','esis','esis/pdu_type_name'],
		['SNDCF Error Report','sndcf_error_report','sndcf_error_report/cause_descr'],
		['CLNP','sndcf_error_report/clnp','sndcf_error_report/clnp/pdu_type_name'],
		['Unknown','sndcf_error_report/clnp/unknown_proto',false],
		['IDRP','sndcf_error_report/clnp/idrp','sndcf_error_report/clnp/idrp/pdu_type_name'],
		['COTP','sndcf_error_report/clnp/cotp/pdu_list',false],
		['CPDLC','sndcf_error_report/clnp/cotp/cpdlc',false],
		['Unknown','sndcf_error_report/clnp/cotp/unknown_proto',false],
		['ADS-C v2','sndcf_error_report/clnp/cotp/adsc_v2',false],
		['X225 SPDU','sndcf_error_report/clnp/cotp/x225_spdu','sndcf_error_report/clnp/cotp/x225_spdu/spdu_type'],
		['X227 APDU','sndcf_error_report/clnp/cotp/x225_spdu/x227_apdu',false],
		['CPDLC','sndcf_error_report/clnp/cotp/x225_spdu/x227_apdu/cpdlc',false],
		['X227 APDU','sndcf_error_report/clnp/cotp/x227_apdu',false],
		['CPDLC','sndcf_error_report/clnp/cotp/x227_apdu/cpdlc',false],
		['Unknown','unknown_proto',false]
	];
	for (var i = 0; i < subpacks.length; i++) {
		var p = subpacks[i];
		if (detree(data,p[1])) {
			if (p[2] && p[2].endsWith('pdu_list')) {
				var type = tpdu_codes(detree(data,p[2]));
			} else if (p[1].endsWith('cpdlc')) {
				var fk = Object.keys(p[1])[1];
				if (! fk) {
					fk = Object.keys(p[1])[0];
				}
				var type = cpdlc_type_lookup[fk];
			} else if (p[2]) {
				var type = detree(data,p[2]);
			} else {
				var type = "";
			}
			if (!type) {type = "";}
			//console.log(type);
			html += '<tr><th>'+p[0]+'</th><td>'+type+'</td></tr>';
		}
	}

	return html
}
function get_x25_type(d) {
	var data = d.vdl2.avlc.x25;

	var cpdlc = snn([
		detree(data,'clnp/cotp/cpdlc'),
		detree(data,'clnp/cotp/x225_spdu/x227_apdu/cpdlc'),
		detree(data,'clnp/cotp/x227_apdu/cpdlc'),
		detree(data,'clnp/sndcf_error_report/clnp/cotp/cpdlc'),
		detree(data,'clnp/sndcf_error_report/clnp/cotp/x225_spdu/x227_apdu/cpdlc'),
		detree(data,'clnp/sndcf_error_report/clnp/cotp/x227_apdu/cpdlc')
	]);
	if (cpdlc && Object.keys(cpdlc).length != 0) { return 'CPDLC';}

	pdu_list = snn([detree(data,'sndcf_error_report/clnp/cotp/pdu_list'), detree(data,'clnp/cotp/pdu_list')]);
	if (pdu_list) {
		pdu_types = tpdu_codes(pdu_list);
	} else {
		pdu_types = "";
	}
	var msg_type_names = [
		detree(data,'sndcf_error_report/clnp/pdu_type_name'),
		detree(data,'sndcf_error_report/clnp/cotp/x225_spdu/spdu_type'),
		detree(data,'sndcf_error_report/clnp/idrp/pdu_type_name'),
		detree(data,'clnp/pdu_type_name'),
		detree(data,'clnp/cotp/x225_spdu/spdu_type'),
		detree(data,'clnp/idrp/pdu_type_name'),
		detree(data,'esis/pdu_type_name'),
		pdu_types,
		detree(data,'pkt_type_name')
	];
	msg_type_name = snn(msg_type_names);

	return msg_type_name;
}
function tpdu_codes(d) {
	var codes = []
	for (var i = d.length - 1; i >= 0; i--) {
		codes.push(d[i].tpdu_code_descr);
	}
	return codes.join(', ');
}
//----------------------------------

//libacars Table
function show_libacars_media_adv(ma,el) {
	var linksavail = [];
	for (var i = 0; i < ma.links_avail.length; i++) {
		linksavail.push(ma.links_avail[i].descr);
	}
	var html = '<table class="outtabs"><tr><th colspan="2" class="outtabhead">Decoded ACARS</th></tr><tr><th>Type</th><td>Media Advisory</td><tr>';
	html += '<tr><th>Error</th><td>'+String(ma.err)+'</td></tr>';
	html += '<tr><th>Version</th><td>'+String(ma.version)+'</td></tr>';
	html += '<tr><th>Cur. Link</th><td>'+ma.current_link.descr;
	if (ma.current_link.established) { html += " (established)";}
	if (ma.current_link.time) {
		if (ma.current_link.time.hour < 10) { var hour = "0"+String(ma.current_link.time.hour); } else { var hour = String(ma.current_link.time.hour); }
		if (ma.current_link.time.min < 10) { var min = "0"+String(ma.current_link.time.min); } else { var min = String(ma.current_link.time.min); }
		if (ma.current_link.time.sec < 10) { var sec = "0"+String(ma.current_link.time.sec); } else { var sec = String(ma.current_link.time.sec); }
		html += '<tr><th>Time</th><td>'+hour+':'+min+':'+sec+'</td>';
	}
	html += '</td></tr>';
	html += '<tr><th>Links avail.</th><td>'+linksavail.join(', ')+'</td></tr>';
	html += '</table>'

	el.innerHTML += html;
}
function show_libacars_miam(miam,el) {
	var type = Object.keys(miam)[0];
	var html = '<table class="outtabs"><tr><th colspan="2 " class="outtabhead">Decoded ACARS</th></tr><tr><th>Type</th><td>MIAM - '+miam_type_lookup[type]+'</td><tr>';
	if (type == 'single_transfer') {
		var core = miam.single_transfer.miam_core;
		html += '<tr><th>Version</th><td>'+String(core.version)+'</td></tr>';
		html += '<tr><th>PDU Type</th><td>'+String(core.pdu_type)+'</td></tr>';
		if ('data' in core) {
			html += '<tr><th>Msg Num</th><td>'+String(core.data.msg_num)+'</td></tr>';
			html += '<tr><th>Ack Req</th><td>'+String(core.data.ack_required)+'</td></tr>';
			html += '<tr><th>Compression</th><td>'+String(core.data.compression)+'</td></tr>';
			html += '<tr><th>App Type</th><td>'+String(core.data.app_type)+'</td></tr>';
			if ('non_acars' in core.data) {
				html += '<tr><th colspan="2">Non-ACARS</th></tr>';
				html += '<tr><th>App ID</th><td>'+String(core.data.non_acars.app_id)+'</td></tr>';
				if (core.data.non_acars.pdu_len) {html += '<tr><th>PDU Len</th><td>'+String(core.data.non_acars.pdu_len)+'</td></tr>';}
				if (core.data.non_acars.aircraft_id) {html += '<tr><th>AC ID</th><td>'+String(core.data.non_acars.aircraft_id)+'</td></tr>';}
				if (core.data.non_acars.message.text) {
					html += '<tr><th>Msg</th><td>'+String(core.data.non_acars.message.text).replace("\n","<br>")+'</td></tr>';
				}
			}
			if ('acars' in core.data) {
				html += '<tr><th colspan="2">ACARS</th></tr>';
				html += '<tr><th>Label</th><td>'+String(core.data.acars.label)+'</td></tr>';
				if (core.data.acars.sublabel) {html += '<tr><th>Sublabel</th><td>'+String(core.data.acars.sublabel)+'</td></tr>';}
				if (core.data.acars.message.text) {
					html += '<tr><th>Msg</th><td>'+String(core.data.acars.message.text).replace("\n","<br>")+'</td></tr>';
				}
			}
		}
		if ('ack' in core) {
			html += '<tr><th colspan="2">Acknowledge</th></tr>';
			html += '<tr><th>PDU Len</th><td>'+String(core.ack.pdu_len)+'</td></tr>';
			html += '<tr><th>AC ID</th><td>'+String(core.ack.aircraft_id)+'</td></tr>';
			html += '<tr><th>MSG Ack Num</th><td>'+String(core.ack.msg_ack_num)+'</td></tr>';
			html += '<tr><th>Ack XFER Result</th><td>'+String(core.ack.ack_xfer_result)+'</td></tr>';
		}
		if ('aloha_reply' in core) {
			html += '<tr><th colspan="2">Aloha Reply</th></tr>';
			html += '<tr><th>PDU Len</th><td>'+String(core.aloha_reply.pdu_len)+'</td></tr>';
			html += '<tr><th>AC ID</th><td>'+String(core.aloha_reply.aircraft_id)+'</td></tr>';
			html += '<tr><th>Selected Compression</th><td>'+String(core.aloha_reply.comp_selected.join(', '))+'</td></tr>';
			html += '<tr><th>Networks Supported</th><td>'+String(core.aloha_reply.networks_supported.join(', '))+'</td></tr>';
		}
	}
	el.innerHTML += html;
}
function show_libacars_arinc(d,el) {
	var type = arinc_type_lookup[d.msg_type];
	var gs_addr = String(d.gs_addr);
	if (gs_addr_lookup.hasOwnProperty(d.gs_addr)) { gs_addr += " ("+gs_addr_lookup[d.gs_addr][1]+")"; }

	var html = '<table class="outtabs"><tr><th colspan="2 " class="outtabhead">Decoded MSG</th></tr><tr><th>Type</th><td>'+type+'</td></tr>';
	html += '<tr><th>CRC OK</th><td>'+String(d.crc_ok)+'</td></tr>';
	html += '<tr><th>GS Addr</th><td>'+gs_addr+'</td></tr>';

	html += '<tr><th>AC Addr</th><td>'+String(d.air_addr)+'</td></tr>';
	if ('adsc' in d) {
		html += adsc_tab(d['adsc']);
	} else if ('cpdlc' in d) {
		html += cpdlc_tab(d['cpdlc']);
	}
	html += '</table>';
	el.innerHTML += html;
}

function adsc_tab(d) {
	var html = "";
	for (i in d.tags) {
		var t = d.tags[i];
		var type = Object.keys(t)[0];
		html += '<tr><th colspan="2">'+tag_type_lookup[type]+'</th></tr>';
		var st = t[type];
		if ('contract_num' in st) { html += '<tr><th>Contract Num</th><td>'+String(st['contract_num'])+'</td></tr>'; }

		//Basic Report stuff
		if ('lat' in st && 'lon' in st) { html += '<tr><th>Position</th><td>'+String(st['lat'])+', '+String(st['lon'])+'</td></tr>'; }
		if ('alt' in st) { html += '<tr><th>Altitude</th><td>'+String(st['alt'])+'ft</td></tr>'; }
		if ('ts_sec' in st) { html += '<tr><th>Past last hour</th><td>'+String(st['ts_sec'])+'s</td></tr>'; }
		if ('pos_accuracy_nm' in st) { html += '<tr><th>Position accuracy</th><td>'+String(st['pos_accuracy_nm'])+'nm</td></tr>'; }
		if ('nav_redundancy' in st) { html += '<tr><th>NAV Redundancy</th><td>'+String(st['nav_redundancy'])+'</td></tr>'; }
		if ('tcas_avail' in st) { html += '<tr><th>TCAS Avail</th><td>'+String(st['tcas_avail'])+'</td></tr>'; }

		//Meteo data
		if(st.wind_dir_valid) { var wd_valid = " (validated)"; } else { var wd_valid = ""; }
		if ('wind_spd_kts' in st) { html += '<tr><th>Wind Speed</th><td>'+String(st['wind_spd_kts'])+'kts</td></tr>'; }
		if ('wind_dir_true_deg' in st) { html += '<tr><th>Wind dir</th><td>'+st['wind_dir_true_deg'].toFixed(1)+'° '+wd_valid+'</td><tr>'; }
		if ('temp_c' in st) { html += '<tr><th>Temperature</th><td>'+String(st['temp_c'])+'°C</td><tr>'; }

		//Air/Earth Ref data
		if (st.true_trk_valid) {var trk_valid = " (validated)"; } else { var trk_valid = ""; }
		if (st.true_hdg_valid) {var hdg_valid = " (validated)"; } else { var hdg_valid = ""; }
		if ('true_trk_deg' in st) { html += '<tr><th>Track</th><td>'+String(st['true_trk_deg'])+'°'+trk_valid+'</td></tr>'; }
		if ('true_hdg_deg' in st) { html += '<tr><th>Heading</th><td>'+String(st['true_hdg_deg'])+'°'+hdg_valid+'</td></tr>'; }
		if ('gnd_spd_kts' in st) { html += '<tr><th>Ground Speed</th><td>'+String(st['gnd_spd_kts'])+'kts</td></tr>'; }
		if ('spd_mach' in st) { html += '<tr><th>Speed Mach</th><td>'+String(st['spd_mach'])+'</td></tr>'; }
		if ('vspd_ftmin' in st) { html += '<tr><th>Vert Speed</th><td>'+String(st['vspd_ftmin'])+'ft/min</td></tr>'; }

		//Airframe ID
		if ('icao_id' in st) { html += '<tr><th>Airframe ID</th><td>'+String(st['icao_id'].toString(16))+'ft/min</td></tr>'; }

		//Fixed Proj
		if ('eta_sec' in st) { html += '<tr><th>ETA Sec</th><td>'+String(st['eta_sec'])+'</td></tr>'; }

		//Flight ID
		if ('flight_id' in st) { html += '<tr><th>Flight ID</th><td>'+String(st['flight_id'])+'</td></tr>'; }

		//Intermediate Proj
		if ('dist_nm' in st) { html += '<tr><th>Distance</th><td>'+String(st['dist_nm'])+'nm</td></tr>'; }

		//Predicted Route
		if ('next_wpt' in st) {
			if (st.next_wpt.lat) { var lat = String(st.next_wpt.lat); } else { var lat = "";}
			if (st.next_wpt.lon) { var lon = String(st.next_wpt.lon); } else { var lon = "";}
			if (st.next_wpt.alt) { var alt = String(st.next_wpt.alt)+'ft'; } else { var alt = "";}
			if (st.next_wpt.eta_sec) { var eta_sec = String(st.next_wpt.eta_sec)+"s"; } else { var eta_sec = "?";}
			html += '<tr><th>Next Waypoint</th><td>'+lat+', '+lon+', '+alt+'; ETA: '+eta_sec+'</td></tr>';
		}
		if ('next_next_wpt' in st) {
			if (st.next_next_wpt.lat) { var lat = String(st.next_next_wpt.lat); } else { var lat = "";}
			if (st.next_next_wpt.lon) { var lon = String(st.next_next_wpt.lon); } else { var lon = "";}
			if (st.next_next_wpt.alt) { var alt = String(st.next_next_wpt.alt)+'ft'; } else { var alt = "";}
			if (st.next_next_wpt.eta_sec) { var eta_sec = String(st.next_next_wpt.eta_sec); } else { var eta_sec = "";}
			html += '<tr><th>Next Next Waypoint</th><td>'+lat+', '+lon+', '+alt+'; ETA: '+eta_sec+'s</td></tr>';
		}



		if (! ('groups' in st)) {
			continue;
		}

		html += '<tr><th colspan="2">Contract Groups</th></tr>';
		for (g in st.groups) {
			var group = st.groups[g];
			var gtype = Object.keys(group)[0];
			var i = "";
			if (gtype == 'report_when_lateral_dev_exceeds') {
				var i = String(group[gtype].lat_dev_treshold_nm)+" nm";
			}
			if (gtype == 'report_interval') {
				var i = String(group[gtype].interval_secs)+" s";
			}
			if (gtype == 'report_when_vspd_is') {
				var i = String(group[gtype].vspd_ftmin_threshold)+" ft/min";
			}
			if (gtype == 'report_when_alt_out_of_range') {
				var i = String(group[gtype].floor_alt)+"ft, "+String(group[gtype].ceiling_alt)+"ft";
			}
			if (gtype == 'report_wpt_changes') {
				var i = "";
			}
			if (gtype == 'flight_id' || gtype == 'predicted_route' || gtype == 'earth_ref_data' || gtype == 'air_ref_data' || gtype == 'meteo_data' || gtype == 'airframe_id' || gtype == 'acft_intent_data') {
				var i = String(group[gtype].modulus);

			}

			html += "<tr><td>"+group_type_lookup[gtype]+'</td><td>'+i+'</td></tr>';
		}
	}
	return html;
}
function cpdlc_tab(d) {
	var html = "";
	var type = Object.keys(d)[1];
	if (!type) {
		type = Object.keys(d)[0];
	}
	html += '<tr><th colspan="2">'+cpdlc_type_lookup[type]+'</th></tr>';

	if (d[type].header && d[type].header.timestamp) {
		if (d[type].header.timestamp.hasOwnProperty('hour')) {
			var ts_root = d[type].header.timestamp;
		} else {
			var ts_root = d[type].header.timestamp.time;
		}
		if (ts_root.hour < 10) { var hour = "0"+String(ts_root.hour); } else { var hour = String(ts_root.hour); }
		if (ts_root.min < 10) { var min = "0"+String(ts_root.min); } else { var min = String(ts_root.min); }
		if (ts_root.sec < 10) { var sec = "0"+String(ts_root.sec); } else { var sec = String(ts_root.sec); }

		html += '<tr><th>Time</th><td>'+hour+':'+min+':'+sec+'</td><tr>';
	}
	if (d[type].hasOwnProperty(type+'_element_id')) {
		var msg = cpdlc_msg_assemble(d[type][type+'_element_id']);
		html += "<tr><th>Message</th><td>"+msg+"</td></tr>";
	}

	if ('atc_uplink_msg_element_id_seq' in d[type]) {
		var seq = d[type].atc_uplink_msg_element_id_seq;
		for (var i = 0; i < seq.length; i++) {
			var msg = cpdlc_msg_assemble(seq[i][type+'_element_id'])

			html += "<tr><th>Message SEQ</th><td>"+msg+"</td></tr>";
		}
	}
	if ('msg_data' in d[type] && 'msg_elements' in d[type].msg_data) {
		var seq = d[type].msg_data.msg_elements;
		for (var i = 0; i < seq.length; i++) {
			var msg = cpdlc_msg_assemble(seq[i].msg_element)

			html += "<tr><th>Message Element</th><td>"+msg+"</td></tr>";
		}
	}

	return html;
}
function cpdlc_msg_assemble(ele) {
	var cpdlc_replace = {
		'[freetext]': "free_text",
		'[icaofacilitydesignation]': "icao_facility_designation",
		'[tp4table]': "tp4table",
		'[beaconcode]': "beacon_code",
		'[icaounitname]': "icao_facility_name",
		'[errorinformation]': "err_info",
		'[tofrom]': "to_from",
		'[direction]': "dir",

	}


	var msg = ele.choice_label;

	if (! msg.includes("[")) {
		return msg.toUpperCase();
	}

	for (rlabel in cpdlc_replace) {
		if (msg.includes(rlabel)) {
			var rtxt = String(find_key_rec(ele.data, cpdlc_replace[rlabel]));
			msg = msg.replace(rlabel, rtxt);
		}
	}
	if (msg.includes("[position]")) {
		var ll = find_key_rec(ele.data, "lat_lon");
		var rtxt = convert_coord(ll.lat)+convert_coord(ll.lon);
		msg = msg.replace("[position]", rtxt);
	}
	if (msg.includes("[altitude]")) {
		var fl = find_key_rec(ele.data, "flight_level");
		if (fl == "") {
			var fl = find_key_rec(ele.data, "alt_qnh");
			var rtxt = String(fl.val)+String(fl.unit);
		} else {
			var rtxt = "FL "+String(fl);
		}
		msg = msg.replace("[altitude]", rtxt);
	}
	if (msg.includes("[frequency]")) {
		var vhf = find_key_rec(ele.data, "vhf");
		if (vhf == "") {
			var vhf = find_key_rec(ele.data, "hf");
		}
		var rtxt = String(vhf.val)+" "+String(vhf.unit);
		msg = msg.replace("[frequency]", rtxt);
	}
	if (msg.includes("[time]")) {
		var time = find_key_rec(ele.data, "time");
		if (time.hour < 10) { hour = "0"+String(time.hour)} else {hour = String(time.hour)}
		if (time.min < 10) { min = "0"+String(time.min)} else {min = String(time.min)}
		var rtxt = hour+":"+min;
		msg = msg.replace("[time]", rtxt);
	}
	if (msg.includes("[degrees]")) {
		var dm = find_key_rec(ele.data, "deg_mag");
		var rtxt = String(dm.val)+"°";
		msg = msg.replace("[degrees]", rtxt);
	}
	if (msg.includes("[distanceoffset]")) {
		var dof = find_key_rec(ele.data, "dist_offset_nm");
		var rtxt = String(dof.val)+"nm";
		msg = msg.replace("[distanceoffset]", rtxt);
	}
	if (msg.includes("[speed]")) {
		var spd = find_key_rec(ele.data, "speed_true");
		if (spd == "") {
			var spd = find_key_rec(ele.data, "speed_mach");
			var rtxt = "MACH "+String(spd.val);
		} else {
			var rtxt = String(spd.val)+String(spd.unit);
		}
		msg = msg.replace("[speed]", rtxt);
	}
	if (msg.includes("[routeclearance]")) {
		var dest = find_key_rec(ele.data, "airport_dst");
		var wpts = [];
		for (var i = ele.data.rte_clearance.rte_info_seq.length - 1; i >= 0; i--) {
			var wpt = ele.data.rte_clearance.rte_info_seq[i].rte_info;
			if (wpt.choice == "latitudeLongitude") {
				wpts.push(convert_coord(wpt.data.lat_lon.lat)+convert_coord(wpt.data.lat_lon.lon));
			}
			if (wpt.choice == "publishedIdentifier") {
				wpts.push(wpt.data.published_identifier.fix);
			}
		}
		var rtxt = "TO "+dest+" VIA "+wpts.join(", ");
		msg = msg.replace("[routeclearance]", rtxt);
	}

	return msg.toUpperCase();
}
function find_key_rec(o,findkey) {
	for (k in o) {
		if (k == findkey) {
			return o[k];
		}
		if (typeof o[k] == "object") {
			var r = find_key_rec(o[k],findkey);
			if (r != "") {
				return r;
			}
		}
	}
	return ""
}
function convert_coord(dir) {
	out = ""
	if ('deg' in dir) {
		out += String(dir.deg)+"°"
	}
	if ('min' in dir) {
		out += String(dir.min)+"'"
	}
	if ('sec' in dir) {
		out += String(dir.sec)+"''"
	}
	if ('dir' in dir) {
		if (dir.dir == "north") {
			out += 'N ';
		}
		if (dir.dir == "south") {
			out += 'S ';
		}
		if (dir.dir == "east") {
			out += 'E ';
		}
		if (dir.dir == "west") {
			out += 'W ';
		}
	}
	return out;
}
function fd_list_freq(d) {
	var flist = [];
	for (var i = d.length - 1; i >= 0; i--) {
		flist.push(d[i].freq);
	}
	var sflist = flist.sort(function(a, b){return a - b});
	return sflist.join(", ")
}
function spdu_gs_freqlist(gs) {
	flist = [];
	for (var i = gs.freqs.length - 1; i >= 0; i--) {
		var f = gs.freqs[i].freq;
		flist.push(f);
	}
	var sflist = flist.sort(function(a, b){return a - b});
	return sflist.join(", ")
}

//Search
function cleartab() {
	if (s) {
		s.close();
	}

	var els = document.getElementsByClassName('datarow');
	for (var i = els.length - 1; i >= 0; i--) {
		var el = els[i];
		el.parentNode.removeChild(el);
	}
	mainmapmarkers.clearLayers();

	id = 0;
}
function startlive() {
	cleartab();
	connectWS();
}
function startsearch() {
	data = {}

	var full = document.getElementById('fullsearch').value;
	if (full) {
		data['fullsearch'] = full;
	}
	$.modal.close();
	cleartab();
	start_spinner();
	update_status('s');

	$.getJSON('cgi-bin/data.min.py',data,function(d){
		if (d.length == 0) {
			var table = document.getElementById("maintab");
			var row = table.insertRow(1);
			row.classList.add('datarow');
			row.innerHTML = '<td style="color:red;font-size: 30px;" colspan="9">No data!</td>'
			stop_spinner();
			return;
		}
		for (var i = 0; i < d.length; i++) {
			var row = {'data': d[i]};
			buildRow(row);
		}
		stop_spinner();
	});
}
//Send Search Form on Enter
window.onkeydown= function(x){
	if(x.code === 'Enter'){
		if (document.getElementById('searchmodal').style.display == "inline-block") {
			startsearch();
		}
	}
}



/*JSON Viewer*/
function buildTree(el,data,par=false) {
	var ul = document.createElement('ul');
	ul.classList.add('jsonviewul');
	if (par) {
		ul.classList.add('active');
	}
	for (k in data) {
		var d = data[k];
		if (d == null) {
			d = 'NULL';
		}
		var li = document.createElement('li');
		if (typeof d == 'object') {
			var span = document.createElement('span');
			span.innerHTML = '<span class="jsonkey">'+k+'</span>:';
			span.classList.add('caret-down');
			li.appendChild(span);
			buildTree(li,d,true);
		} else {
			li.innerHTML = '<span class="jsonkey">'+k+'</span>: '+style_jsonval(d);
		}
		ul.appendChild(li);
	}
	el.appendChild(ul);
	if (! par) {
		var toggler = document.getElementsByClassName("caret-down");
		var i;
		for (i = 0; i < toggler.length; i++) {
			toggler[i].addEventListener("click", function() {
				this.parentElement.querySelector(".active").classList.toggle("nested");
				this.classList.toggle("caret");
			});
		}
	}
}
function style_jsonval(v) {
	if (v == 'NULL') {
		return '<span style="color: #b3b3b3;">NULL</span>';
	}
	var t = typeof v;
	if (t == 'number') {
		return '<span style="color: #00cc00;">'+v+'</span>';
	}
	if (t == 'boolean') {
		return '<span style="color: #ff9933;">'+v+'</span>';
	}
	return '<span style="color: #ff6666;">"'+v+'"</span>';
}

//libacars Tabs
//search

//Init
connectWS()