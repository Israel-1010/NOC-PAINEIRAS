// Tipo de midia (webhook) do Zabbix "WhatsApp (Evolution)": envia problemas e recuperacoes a um grupo
// de WhatsApp pela Evolution API (v1 ou v2).
// Parametros do tipo de midia:
//   evolution_url, instance, apikey  -> dados da Evolution API
//   to                               -> destino do usuario (ID do grupo, ex.: 120363...@g.us)
//   host, name, severity, nseverity, event_value, update_status, time, date, age, duration,
//   recovery_time, groups, event_id  -> macros do evento (preenchidas nos parametros do tipo de midia)
// Nao escreva nomes de macro neste texto: o Zabbix substitui pelo valor.

var p = JSON.parse(value);
var base = String(p.evolution_url || '').replace(/\/$/, '');
if (!base || !p.instance || !p.apikey || !p.to) throw 'Faltam parametros da Evolution API (url, instancia, chave ou grupo).';

var ICONS = ['⚪', '🔵', '🟡', '🟠', '🔴', '🚨'];
var NAMES = ['Não classificado', 'Informação', 'Atenção', 'Média', 'Alta', 'Desastre'];
var resolved = String(p.event_value) === '0';
var updated = String(p.update_status) === '1';
var sev = parseInt(p.nseverity, 10);
var icon = resolved ? '✅' : (ICONS[sev] || '⚠️');

function clean(v) {
  var s = String(v === undefined || v === null ? '' : v);
  // macro sem valor chega como o proprio texto entre chaves: descarta
  return /^\{[A-Z.]+\}$/.test(s) ? '' : s;
}

var lines = [];
if (resolved) {
  lines.push(icon + ' *RESOLVIDO* · *' + clean(p.host) + '*');
  lines.push(clean(p.name));
  var dur = clean(p.duration);
  var rec = clean(p.recovery_time);
  lines.push('⏱ ' + (dur ? 'Durou ' + dur : 'Normalizado') + (rec ? ' · voltou às ' + rec : ''));
} else {
  lines.push(icon + ' *' + (NAMES[sev] || clean(p.severity)).toUpperCase() + '* · *' + clean(p.host) + '*' + (updated ? ' (atualização)' : ''));
  lines.push(clean(p.name));
  var since = clean(p.time);
  var age = clean(p.age);
  if (since) lines.push('🕒 Desde ' + since + (age ? ' (há ' + age + ')' : ''));
}
var groups = clean(p.groups);
if (groups) lines.push('📂 ' + groups);
var text = lines.filter(function (l) { return l; }).join('\n');

function send(body) {
  var req = new HttpRequest();
  req.addHeader('Content-Type: application/json');
  req.addHeader('apikey: ' + p.apikey);
  var resp = req.post(base + '/message/sendText/' + encodeURIComponent(p.instance), JSON.stringify(body));
  return { status: req.getStatus(), body: String(resp || '').slice(0, 300) };
}

// v2: { number, text } · v1: { number, textMessage: { text } }
var result = send({ number: p.to, text: text });
if (result.status === 400) result = send({ number: p.to, options: { delay: 0 }, textMessage: { text: text } });
if (result.status < 200 || result.status >= 300) throw 'Evolution API respondeu ' + result.status + ': ' + result.body;
return 'OK';
