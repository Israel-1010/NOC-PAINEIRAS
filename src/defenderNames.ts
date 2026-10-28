// Titulos dos incidentes/alertas do Microsoft Defender (vem em ingles) em portugues.
// Usado no Painel NOC e no menu "Microsoft Defender"; sem traducao, mostra o original.
const DEFENDER_NAMES: [RegExp, string][] = [
  [/malicious URL click/i, "Clique em link malicioso"],
  [/initial access/i, "Tentativa de acesso inicial (e-mail)"],
  [/user compromise investigation/i, "Investigação de usuário comprometido"],
  [/multi-stage.*command and control/i, "Ataque em etapas com comando e controle"],
  [/password stealing/i, "Roubo de senhas em arquivos"],
  [/reverse (TCP )?shell/i, "PowerShell abriu possível acesso remoto (reverse shell)"],
  [/suspicious powershell/i, "Comando PowerShell suspeito"],
  [/credential phish/i, "Phishing de senha"],
  [/unfamiliar sign-in/i, "Login com características incomuns"],
  [/elevated privileges/i, "Privilégio de administrador dado e removido (suspeito)"],
  [/impossible travel|atypical travel/i, "Login de lugares distantes ao mesmo tempo"],
  [/password spray/i, "Ataque de senha em massa (password spray)"],
  [/inbox (manipulation|forwarding)|forwarding rule/i, "Regra suspeita na caixa de e-mail"],
  [/malware incident/i, "Malware em máquina"],
  [/malware was prevented/i, "Malware bloqueado na máquina"],
  [/custom network indicator/i, "Acesso a endereço bloqueado pela TI"],
  [/not removed after delivery/i, "E-mail malicioso não removido (ação manual)"],
  [/campaign removed after delivery/i, "E-mails de campanha removidos após a entrega"],
  [/malicious URL removed after delivery/i, "E-mails com link malicioso removidos"],
  [/removed after delivery/i, "E-mails removidos após a entrega"],
  [/reported by user as malware or phish/i, "Usuário reportou phishing"],
  [/reported by user as not junk/i, "Usuário reportou e-mail legítimo"],
  [/release a quarantined/i, "Pedido de liberação da quarentena"],
  [/admin submission/i, "Análise enviada pela TI concluída"],
];

export const defenderName = (title: string) => DEFENDER_NAMES.find(([pattern]) => pattern.test(title))?.[1] || title;
