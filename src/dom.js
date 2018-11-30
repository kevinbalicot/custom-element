const EVALUATE_PATTERN = /\{\{([\s\S]+?)\}\}/;

class TextNode {
    constructor(element, parent, state) {
        this.element = element;
        this.template = String(element.data);
        this.state = state;
        this.bindings = {};

        const regexp = new RegExp(EVALUATE_PATTERN, 'g');
        const matches = this.template.match(regexp);

        (matches || []).forEach(match => {
            const [ complet, property ] = new RegExp(EVALUATE_PATTERN).exec(match);
            this.bindings[property.trim()] = complet;
        });
    }

    get data() {
        let template = String(this.template);
        for (let property in this.bindings) {
            if (undefined !== this.state[property.trim()]) {
                template = template.replace(this.bindings[property], this.state[property.trim()]);
            } else {
                throw new Error(`Variable ${property.trim()} not found in "${this.bindings[property]}".`);
            }
        }

        return template;
    }
}

class Node {
    constructor(element, parent, children = [], state = {}) {
        this.element = element;
        this.textNodes = [];
        this.parent = parent;
        this.children = children;
        this.state = state;

        for (let i = 0; i < this.element.childNodes.length; i++) {
            if (this.element.childNodes[i] instanceof Text) {
                this.textNodes.push(new TextNode(this.element.childNodes[i], this.element, this.state));
            }
        }

        this.bindings = [].concat(...this.textNodes.map(node => Object.keys(node.bindings)));
    }

    update() {
        this.textNodes.forEach(textNode => textNode.element.data = textNode.data);
    }

    dispatch(event, data) {
        if (this.bindings.some(b => data.indexOf(b) !== -1)) {
            this.update();
        }
    }
}

class IfNode extends Node {
    constructor(element, parent, children = [], state = {}) {
        super(element, parent, children, state);

        this.if = this.element.getAttribute('if');
        this.mask = document.createTextNode('');
        this.hidden = false;
    }

    update() {
        const f = new Function(...(Object.keys(this.state).concat([`return ${this.if}`])));
        const result = f(...(Object.values(this.state)));
        if (!result && !this.hidden) {
            this.parent.replaceChild(this.mask, this.element);
            this.hidden = true;
        } else if (result && this.hidden) {
            this.parent.replaceChild(this.element, this.mask);
            this.hidden = false;
            super.update();
        } else {
            super.update();
        }
    }

    dispatch(event, data) {
        this.update();
    }
}

class ForNode {
    constructor(element, parent, state = {}) {
        this.element = element;
        this.parent = parent;
        this.state = state;

        this.for = this.element.getAttribute('for').match(/(?:var|let)\s+(\S+)\s+(?:in|of)\s+(\S+)/);
        this.mask = document.createTextNode('');
        this.children = [];

        this.parent.replaceChild(this.mask, this.element);
    }

    update() {
        this.children.forEach(child => this.parent.removeChild(child.element));
        this.children = [];

        const iteration = (element, elements) => {
            const index = elements.indexOf(element);
            const state = {};
            const elementClone = this.element.cloneNode(true);
            elementClone.removeAttribute('for');

            this.mask.before(elementClone);

            state[this.for[1]] = elements[index];

            const dom = buildDOM(elementClone, this.parent, Object.assign(state, this.state));
            updateDOM(dom);

            this.children.push(dom);
        };

        const f = new Function(...Object.keys(this.state).concat(['iteration', `for (${this.for[0]}) { iteration(${this.for[1]}, ${this.for[2]}); }`]));
        f(...Object.values(this.state).concat([iteration]));
    }

    dispatch(event, data) {
        this.update();
    }
}

const buildDOM = (element, parent, state = {}) => {
    const children = [];
    for (let i = 0; i < element.children.length; i++) {
        children.push(buildDOM(element.children[i], element, state));
    }

    if (element.hasAttribute('for')) {
        return new ForNode(element, parent, state);
    }

    if (element.hasAttribute('if')) {
        return new IfNode(element, parent, children, state);
    }

    return new Node(element, parent, children, state);
};

const updateDOM = (node) => {
    node.update();
    node.children.forEach(n => updateDOM(n));
};

const dispatch = (node, event, data) => {
    node.dispatch(event, data);
    node.children.forEach(n => dispatch(n, event, data));
};
