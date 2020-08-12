const { createVirtualDOM, updateElement } = require('./../vdom');

class TreeNode {
    constructor() {
        this._html = null;
        this.root = null;
        this.oldVirtualDom = null;
        this.newVirtualDom = null;
    }

    set html(html) {
        if (this._html instanceof HTMLTemplateElement) {
            this._html = html;
        } else {
            this._html = html.trim();
        }
    }

    get html() {
        if (this._html instanceof HTMLTemplateElement) {
            return this._html.cloneNode(true);
        }

        const template = document.createElement('template');
        template.innerHTML = this._html;

        return template;
    }

    render(root, html, scope, details = {}) {
        this.root = root;
        this.html = html;
        this.oldVirtualDom = createVirtualDOM(this.root, scope, details);
        this.newVirtualDom = createVirtualDOM(this.html.content, scope, details);

        // special case, deal with it ;)
        if (this.root.assignedSlot) {
            this.oldVirtualDom.children = [];
            this.root.innerHTML = null;
        }

        updateElement(this.root, this.newVirtualDom, this.oldVirtualDom, scope, details);
    }

    update(scope, details) {
        this.oldVirtualDom = this.newVirtualDom;
        this.newVirtualDom = createVirtualDOM(this.html.content, scope, details);

        updateElement(this.root, this.newVirtualDom, this.oldVirtualDom, scope, details);
    }
}

module.exports = TreeNode;