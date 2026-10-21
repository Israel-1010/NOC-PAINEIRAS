// Item Script do Zabbix "NOC: resumo da controladora UniFi" (chave noc.unifi.summary, texto, a cada 30 s).
// Usado pelo Painel NOC para controladoras que o portal nao alcanca (ex.: 192.168.2.10 no host CPM68).
// Parametros do item: url, user, password, sites -> macros NOC.UNIFI.URL / .USER / .PASSWORD / .SITES
// (usuario e senha como macros GLOBAIS, senha secreta). Nao escreva nomes de macro neste texto:
// o Zabbix substitui pelo valor (inclusive a senha) e ele pode aparecer em mensagens de erro.
// Item Script do Zabbix (Duktape, ES5): resumo da controladora UniFi para o Painel NOC.
// Um login por execucao, le antenas/switches/clientes/alarmes de todos os sites e sai (logout).
var p = JSON.parse(value);
var base = String(p.url || '').replace(/\/$/, '');
// Atencao: nao escrever nomes de macro neste texto; o Zabbix os substitui pelo valor (inclusive a senha).
if (!base) throw 'Preencha a macro NOC.UNIFI.URL no host.';
if (!p.user || !p.password || p.password === 'PREENCHER') {
  // Sem credencial ainda: ao menos mostra se o Zabbix alcanca a controladora.
  var probe = new HttpRequest();
  var reply = probe.get(base + '/status');
  var ver = '';
  try { ver = JSON.parse(reply).meta.server_version; } catch (e) { ver = ''; }
  if (probe.getStatus() === 200 && ver) throw 'Controladora alcanÃ§ada (UniFi ' + ver + '). Falta preencher as macros NOC.UNIFI.USER e NOC.UNIFI.PASSWORD no host.';
  throw 'Sem resposta da controladora em ' + base + ' (HTTP ' + probe.getStatus() + '). Confira o endereÃ§o/porta.';
}

function headerValues(headers, name) {
  var out = [];
  for (var key in headers) {
    if (key.toLowerCase() === name) {
      var v = headers[key];
      out = out.concat(Object.prototype.toString.call(v) === '[object Array]' ? v : [v]);
    }
  }
  return out;
}

var cookie = '';
function call(method, path, body) {
  var req = new HttpRequest();
  req.addHeader('Content-Type: application/json');
  req.addHeader('Accept: application/json');
  if (cookie) req.addHeader('Cookie: ' + cookie);
  var resp = method === 'POST' ? req.post(base + path, body ? JSON.stringify(body) : '{}') : req.get(base + path);
  var status = req.getStatus();
  if (path === '/api/login') return { status: status, body: resp, headers: req.getHeaders(true) };
  if (status !== 200) throw 'UniFi respondeu ' + status + ' em ' + path;
  var parsed = JSON.parse(resp);
  return parsed.data || [];
}

var login = call('POST', '/api/login', { username: p.user, password: p.password });
if (login.status !== 200) {
  var msg = '';
  try { msg = JSON.parse(login.body).meta.msg; } catch (e) { msg = 'HTTP ' + login.status; }
  throw 'Login recusado na controladora (' + msg + ')';
}
cookie = headerValues(login.headers, 'set-cookie').map(function (c) { return String(c).split(';')[0]; }).join('; ');

function num(v) {
  var n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && isFinite(n) ? Math.round(n * 10) / 10 : null;
}
function band(r) { return r === 'ng' ? '2,4 GHz' : r === 'na' ? '5 GHz' : r === '6e' ? '6 GHz' : (r || 'radio'); }

function bps(v) {
  var n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && isFinite(n) ? Math.round(n * 8) : null;
}

var out = { v: 3, at: new Date().toISOString(), version: '', sites: [], aps: [], switches: [], wired: 0, wireless: 0, guests: 0, ssid: {}, bands: {}, sat: null, alarms: [], events: [] };

// Eventos das ultimas 24 h (log da controladora). Eventos de cliente (WU/WG/LU = usuario conectou/saiu)
// sao milhares por dia: ficam de fora; vale o que e de infraestrutura (antena, switch, gateway).
function recentEvents(siteName) {
  var list = [];
  // Consulta leve (100 eventos): a controladora da CPM68 se mostrou instavel.
  try { list = call('POST', '/api/s/' + siteName + '/stat/event', { _limit: 100, within: 24, _sort: '-time' }); }
  catch (e) {
    try { list = call('GET', '/api/s/' + siteName + '/stat/event?within=24&_limit=100'); } catch (e2) { list = []; }
  }
  // Fora tambem EVT_AD_ (login de administrador): o proprio login deste item apareceria a cada execucao.
  return list.filter(function (ev) { return !/^EVT_(WU|WG|LU|AD)_/.test(String(ev.key || '')); });
}
var satSum = 0, satCount = 0;
try {
  var st = new HttpRequest();
  out.version = JSON.parse(st.get(base + '/status')).meta.server_version || '';
} catch (e) { /* sem versao */ }

try {
  var sites = call('GET', '/api/self/sites');
  var wanted = String(p.sites || '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  if (wanted.length) sites = sites.filter(function (s) { return wanted.indexOf(s.name) >= 0 || wanted.indexOf(s.desc) >= 0; });

  for (var i = 0; i < sites.length; i++) {
    var site = sites[i];
    var title = site.desc || site.name;
    out.sites.push({ name: site.name, title: title });
    var devices = call('GET', '/api/s/' + site.name + '/stat/device');
    var clients = call('GET', '/api/s/' + site.name + '/stat/sta');
    var alarms = [];
    try { alarms = call('GET', '/api/s/' + site.name + '/list/alarm?archived=false'); } catch (e) { alarms = []; }

    var byAp = {};
    for (var c = 0; c < clients.length; c++) {
      var cl = clients[c];
      if (cl.is_guest) out.guests++;
      if (cl.is_wired) { out.wired++; continue; }
      out.wireless++;
      if (cl.ap_mac) byAp[cl.ap_mac] = (byAp[cl.ap_mac] || 0) + 1;
      var ss = cl.essid || '(oculta)';
      out.ssid[ss] = (out.ssid[ss] || 0) + 1;
      var bd = band(cl.radio);
      out.bands[bd] = (out.bands[bd] || 0) + 1;
      if (typeof cl.satisfaction === 'number') { satSum += cl.satisfaction; satCount++; }
    }

    for (var d = 0; d < devices.length; d++) {
      var dev = devices[d];
      var stats = dev['system-stats'] || {};
      // Trafego atual: versoes antigas tem tx/rx_bytes-r no aparelho; a 9.x so no uplink (rx do uplink = o que desce aos clientes).
      var link = dev.uplink || {};
      var down = dev['tx_bytes-r'] !== undefined ? dev['tx_bytes-r'] : link['rx_bytes-r'];
      var upl = dev['rx_bytes-r'] !== undefined ? dev['rx_bytes-r'] : link['tx_bytes-r'];
      if (dev.type === 'uap') {
        out.aps.push({
          id: dev.mac, name: dev.name || dev.mac, model: dev.model || '', site: title, online: dev.state === 1,
          cpu: num(stats.cpu), mem: num(stats.mem), clients: byAp[dev.mac] !== undefined ? byAp[dev.mac] : (dev.num_sta || 0), sat: num(dev.satisfaction),
          tx: bps(down), rx: bps(upl), uptime: dev.uptime || null, ver: dev.version || '', upg: !!dev.upgradable,
          ip: dev.ip || '', link: link.type || '',
          radios: (dev.radio_table_stats || []).map(function (r) { return { band: band(r.radio), channel: r.channel === undefined ? null : r.channel, utilization: num(r.cu_total), clients: r.num_sta || 0 }; })
        });
      } else if (dev.type === 'usw') {
        var ports = (dev.port_table || []).filter(function (pt) { return pt.enable !== false; });
        var poe = 0, up = 0;
        for (var k = 0; k < ports.length; k++) { poe += num(ports[k].poe_power) || 0; if (ports[k].up) up++; }
        out.switches.push({
          id: dev.mac, name: dev.name || dev.mac, model: dev.model || '', site: title, online: dev.state === 1,
          cpu: num(stats.cpu), mem: num(stats.mem), temp: num(dev.general_temperature), up: up, total: ports.length,
          poe: Math.round(poe * 10) / 10, clients: dev.num_sta || 0,
          tx: bps(down), rx: bps(upl), uptime: dev.uptime || null, ver: dev.version || '', upg: !!dev.upgradable
        });
      }
    }

    // Alarmes abertos: os mais recentes primeiro (a API devolve os mais antigos antes).
    alarms.sort(function (x, y) { return (y.time || 0) - (x.time || 0); });
    for (var a = 0; a < alarms.length && a < 20; a++) {
      out.alarms.push({ id: alarms[a]._id, site: title, time: alarms[a].datetime || '', msg: alarms[a].msg || alarms[a].key || 'Alarme' });
    }

    var evs = recentEvents(site.name);
    for (var v = 0; v < evs.length; v++) {
      out.events.push({ t: evs[v].datetime || (evs[v].time ? new Date(evs[v].time).toISOString() : ''), k: evs[v].key || '', m: evs[v].msg || '', site: title });
    }
  }
  out.events.sort(function (x, y) { return x.t < y.t ? 1 : x.t > y.t ? -1 : 0; });
  out.events = out.events.slice(0, 60);
} finally {
  try { call('POST', '/api/logout'); } catch (e) { /* sessao expira sozinha */ }
}
out.sat = satCount ? Math.round(satSum / satCount) : null;

// Item de texto do Zabbix guarda ate 64 KB: se passar, corta o que e menos importante.
var text = JSON.stringify(out);
if (text.length > 60000) {
  out.alarms = [];
  out.events = out.events.slice(0, 20);
  for (var x = 0; x < out.aps.length; x++) { delete out.aps[x].ver; delete out.aps[x].model; }
  for (var y = 0; y < out.switches.length; y++) { delete out.switches[y].ver; delete out.switches[y].model; }
  text = JSON.stringify(out);
}
return text;
