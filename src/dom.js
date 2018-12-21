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

    dispatchEvent(event) {
        if (this._lock) {
            return;
        }

        this._lock = true;
        this.customAttributes.forEach(attribute => {
            const levels = attribute.name.replace('[', '').replace(']', '').split('.');
            const value = this.parseExpression('return ' + attribute.value, event.detail, this.root);
            this.applyCustomAttribute(this.element, levels, value);
        });

		this.customEvents.forEach(attribute => {
			const eventName = attribute.name.replace('(', '').replace(')', '');
            this.element.removeEventListener(eventName, this.element[`_${eventName}Handler`]);
			this.element[`_${eventName}Handler`] = $event => this.parseExpression(attribute.value, Object.assign({ $event }, event.detail), this.root);
			this.element.addEventListener(eventName, this.element[`_${eventName}Handler`]);
		});

        this.children.forEach(node => node.dispatchEvent(event));
        this._lock = false
    }

    parseExpression(expression, parameters = {}, scope = {}) {
        const f = new Function(...(Object.keys(parameters).concat([expression])));
        try {
            return f.call(scope, ...(Object.values(parameters)));
        } catch (e) {
            throw new Error(`${e.message} from "${scope.constructor.name} > ${this.element.tagName} > ${expression}"`);
        }
    }

    applyCustomAttribute(element, attributeNames, value) {
        switch (attributeNames[0]) {
            case 'innerhtml':
                element.innerHTML = value;
                break;
            case 'style':
                element.style[attributeNames[1]] = value;
                break;
            case 'class':
                value ? element.classList.add(attributeNames[1]) : element.classList.remove(attributeNames[1]);
                break;
            case 'attribute':
            case 'attr':
                element.setAttribute(attributeNames[1], value);
                break;
            default:
                element[attributeNames[0]] = value;
        }
    }

	get root() {
		// element.getRootNode()
		let element = this.element;
		while(element.nodeType != 11 && element.parentNode) {
			element = element.parentNode;
		}

		return element.host || {};
	}
}

class IfNode extends Node {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.if = this.element.getAttribute('#if');
        this.mask = document.createTextNode('');
        this.hidden = false;
    }

    dispatchEvent(event) {
        var result = this.parseExpression('return ' + this.if, event.detail);

        if (!result && !this.hidden) {
            this.parent.replaceChild(this.mask, this.element);
            this.hidden = true;
        } else if (result && this.hidden) {
            this.parent.replaceChild(this.element, this.mask);
            this.hidden = false;
            super.dispatchEvent(event);
        } else if (!this.hidden) {
            super.dispatchEvent(event);
        }
    }
}

class ForNode extends Node {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.for = this.element.getAttribute('#for').match(/(?:var|let)\s+(\S+)\s+(?:in|of)\s+(\S+)/);
        this.mask = document.createTextNode('');
        this._init = false;

        this.clone = this.element.cloneNode(true);
        this.clone.removeAttribute('#for');

        this.children = [];
    }

    dispatchEvent(event) {
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
            const index = els.indexOf(el);
            const clone = Document.createElement(this.clone.cloneNode(true), this.parent);
            const scope = {};

            scope[this.for[1]] = els[index];
            scope['$index'] = index;

            this.parent.insertBefore(clone.element, this.mask);

            clone.dispatchEvent(new CustomEvent(event.type, { detail: Object.assign({}, event.detail, scope) }));

            this.children.push(clone);
        }

        this.parseExpression(
            'for (' + this.for[0] + ') { iteration(' + this.for[1] + ', ' + this.for[2] + '); }',
            Object.assign({}, event.detail, { iteration }),
			this.root
        );
    }
}

export class Document {
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

        return new Node(element, parent, children);
    }

    static cleanNode(node) {
        node.toRemoveAttributes.forEach(attribute => node.element.removeAttribute(attribute.name));
        node.children.forEach(n => Document.cleanNode(n));
    }
}
