// O <Html> do drei (rotulos sobre a cena 3D) cria um <div> fora do React e, ao trocar de cena,
// as vezes tenta remove-lo de novo depois que ele ja saiu da pagina. O navegador lanca
// "Failed to execute 'removeChild'/'insertBefore' on 'Node'" e o React derruba a tela inteira.
// Aqui essas duas operacoes passam a ignorar o no que ja nao esta onde o React acha que esta
// (mesmo contorno usado contra o tradutor do navegador). Carregado so com a Infraestrutura 3D.

let installed = false;

export function installDomGuard() {
  if (installed || typeof Node === "undefined") return;
  installed = true;

  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };

  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) return this.appendChild(node);
    return insertBefore.call(this, node, reference) as T;
  };
}
