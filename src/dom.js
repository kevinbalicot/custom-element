class Node {
    constructor(element, parent, children) {
        this.element = element;
        this.parent = parent;
        this.children = children;

        this.customAttributes = [];
        this.customEvents = [];
        this.toRemoveAttributes = [];
        if (this.element.attributes) {
            for (let i = 0; i < this.element.attributes.length; i++) {
                if (this.element.attributes[i].name.match(/\[(\S+)\]/g)) {
                    this.customAttributes.push(this.element.attributes[i]);
                    this.toRemoveAttributes.push(this.element.attributes[i]);
                }

                if (this.element.attributes[i].name.match(/\((\S+)\)/g)) {
                    this.customEvents.push(this.element.attributes[i]);
                    this.toRemoveAttributes.push(this.element.attributes[i]);
                }
            }
        }

        this._lock = false;
    }

    update(detail = {}, scope = {}) {
        if (this._lock) {
            return;
        }

        this._lock = true;
        this.customAttributes.forEach(attribute => {
            const levels = attribute.name.replace('[', '').replace(']', '').split('.');
            const value = this.parseExpression('return ' + attribute.value, detail, scope);
            this.applyCustomAttribute(this.element, levels, value);
        });

        this.customEvents.forEach(attribute => {
            const eventName = attribute.name.replace('(', '').replace(')', '');
            this.element.removeEventListener(eventName, this.element[`_${eventName}Handler`]);
            this.element[`_${eventName}Handler`] = $event => this.parseExpression(attribute.value, Object.assign({ $event }, detail), scope);
            this.element.addEventListener(eventName, this.element[`_${eventName}Handler`]);
        });

        this.children.forEach(node => node.update(detail, scope));
        this._lock = false
    }

    parseExpression(expression, parameters = {}, scope = {}) {
        parameters = Object.assign({}, parameters, this.element.dataset);

        const f = new Function(...(Object.keys(parameters).concat([expression])));
        try {
            return f.call(scope, ...(Object.values(parameters)));
        } catch (e) {
            throw new Error(`${e.message} from "${scope.constructor.name} > ${this.element.tagName} > ${expression}"`);
        }
    }

    applyCustomAttribute(element, attributeNames, value) {
        for (let customAttribute of Document.constructor.customAttributes) {
            const { selector, callback } = customAttribute;
            if (attributeNames[0] === selector) {
                return callback(element, value, attributeNames);
            }
        }

        switch (attributeNames[0]) {
            case 'innerhtml':
                element.innerHTML = value;
                break;
            case 'style':
                element.style[attributeNames[1]] = !!attributeNames[2] ? value + attributeNames[2] : value;
                break;
            case 'class':
                value ? element.classList.add(attributeNames[1]) : element.classList.remove(attributeNames[1]);
                break;
            case 'classname':
                element.className = value;
                break;
            case 'attribute':
            case 'attr':
                if (typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                element.setAttribute(attributeNames[1], value);
                break;
            default:
                element[attributeNames[0]] = value;
        }
    }
}

class IfNode extends Node {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.if = this.element.getAttribute('#if');
        this.mask = document.createTextNode('');
        this.hidden = false;
    }

    update(detail = {}, scope = {}) {
        const result = this.parseExpression('return ' + this.if, detail, scope);

        if (!result && !this.hidden) {
            this.parent.replaceChild(this.mask, this.element);
            this.hidden = true;
        } else if (result && this.hidden) {
            this.parent.replaceChild(this.element, this.mask);
            this.hidden = false;
            super.update(detail, scope);
        } else if (!this.hidden) {
            super.update(detail, scope);
        }
    }
}

class ForNode extends Node {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.for = this.element.getAttribute('#for').match(/(?:var|let|const)\s+(\S+)\s+(?:in|of)\s+(\S+)/);
        this.mask = document.createTextNode('');
        this._init = false;

        this.clone = this.element.cloneNode(true);
        this.clone.removeAttribute('#for');

        this.children = [];
    }

    update(detail = {}, scope = {}) {
        if (!this._init) {
            this.parent.replaceChild(this.mask, this.element);
            this._init = true;
        }

        this.children.forEach(child => {
            if (Array.from(this.parent.children).indexOf(child.element) !== -1) {
                this.parent.removeChild(child.element);
            }
        });

        this.children = [];

        const iteration = (el, els) => {
            const index = Array.isArray(els) ? els.indexOf(el) : el;
            const clone = Document.createElement(this.clone.cloneNode(true), this.parent);
            const s = {};

            s[this.for[1]] = Array.isArray(els) ? els[index] : el;
            s['$index'] = index;

            this.parent.insertBefore(clone.element, this.mask);

            clone.update(Object.assign({}, detail, s), scope);

            this.children.push(clone);
        }

        this.parseExpression(
            'for (' + this.for[0] + ') { iteration(' + this.for[1] + ', ' + this.for[2] + '); }',
            Object.assign({}, detail, { iteration }),
            scope
        );
    }
}

class CustomNode extends Node {
    constructor(element, parent, children) {
        super(element, parent, children);
        this.attribute = this.element.getAttribute(this.constructor.selector);
    }

    static get selector() {
        return null;
    }
}

class Document {
    static createElement(element, parent) {
        if (element.hasAttribute && element.hasAttribute('#for')) {
            return new ForNode(element, parent, []);
        }

        const children = [];
        for (let i = 0; i < element.children.length; i++) {
            if (element.children[i].hasAttribute) {
                children.push(Document.createElement(element.children[i], element));
            }
        }

        if (element.hasAttribute && element.hasAttribute('#if')) {
            return new IfNode(element, parent, children);
        }

        for (let customNode of Document.constructor.customNodes) {
            const { selector, className } = customNode;
            if (element.hasAttribute && element.hasAttribute(selector)) {
                return new className(element, parent, children);
            }
        }

        return new Node(element, parent, children);
    }

    static cleanNode(node) {
        node.toRemoveAttributes.forEach(attribute => node.element.removeAttribute(attribute.name));
        node.children.forEach(n => Document.cleanNode(n));
    }

    static searchNode(element, root) {
        if (element === root.element) {
            return root;
        }

        let result;
        for (let i = 0; i < root.children.length; i++) {
            result = Document.searchNode(element, root.children[i]);

            if (null !== result) {
                return result;
            }
        }

        return null;
    }

    static addCustomNode(customNode) {
        Document.constructor.customNodes.push({ selector: customNode.selector, className: customNode });
    }

    static addCustomAttribute(selector, callback) {
        Document.constructor.customAttributes.push({ selector, callback });
    }
}

Document.constructor.customNodes = [];
Document.constructor.customAttributes = [];

module.exports = { CustomNode, Document };
