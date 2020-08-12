# Custom Element

Tiny library to make custom HTML elements

Live demo [https://jsfiddle.net/kevinbalicot/L08q4k21/](https://jsfiddle.net/kevinbalicot/L08q4k21/)


Tests : [![Build Status](https://travis-ci.org/kevinbalicot/custom-element.svg?branch=master)](https://travis-ci.org/kevinbalicot/custom-element)

## Installation

```bash
$ npm install --save @kevinbalicot/custom-element
```

## Get started

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>My site</title>

    <script src="/node_modules/@kevinbalicot/custom-element/dist/custom-element.min.js" charset="utf-8"></script>
</head>
<body>
    <my-component></my-component>

    <script type="application/javascript">
        class MyComponent extends CustomElement {
            constructor() {
                super();

                this.name = 'Jean';
            }

            static get template() {
                return '<h1>Hello <span [innerHTML]="this.name"></span> !</h1>';
            }

            static get styles() {
                return [':host(span) { color: red; }'];
            }
        }
	    
	window.customElements.define('my-component', MyComponent);
    </script>
</body>
</html>
```

## Features

### Input binding

```javascript
class DemoComponent extends CustomElement {
    constructor() {
        super();

        this.text = null;
    }

    /**
    * Call when custom element call connectedCallback (see HTML custom element life cycle)
    */
    onConnected() {
        this.element('input[name=text]').on('input', event => {
            this.text = event.target.value;
            this.update(); // Refresh template

            // You can also to use this.update({ text: event.target.value });
        });
    }

    static get template() {
        return `
            <h2>Demo</h2>
            <hr>

            <h3>Input binding</h3>
            <label id="text">Type something</label><input type="text" name="text">
            <p [innerHTML]="'You tipping: ' + this.text"></p>
        `;
    }
}

window.customElements.define('demo-component', DemoComponent);
```

### For binding

```javascript
class DemoComponent extends CustomElement {
    constructor() {
        super();

        this.items = [];
    }

    onConnected() {
        this.element('form[rol=list]').on('submit', event => {
            event.preventDefault();

            const input = event.target.querySelector('input[name=item]');

            if (input.value) {
                this.items.push(input.value);
                input.value = null;

                this.update();
            }
        });
    }

    onDeleteItem(index) {
        this.items.splice(index, 1);
        this.update();
    }

    static get template() {
        return `
            <h2>Demo</h2>
            <hr>

            <h3>For binding</h3>
            <form rol="list">
                <input type="text" name="item" required>
                <button type="submit">Add</button>
            </form>

            <ul>
                <!-- use #for attribute to make a loop -->
                <li #for="let i of this.items">
                    <span [innerHTML]="i" [class.stronger]="i.length > 5"></span>
                    <button (click)="this.onDeleteItem($index)">Delete</button>
                </li>
            </ul>
        `;
    }

    static get styles() {
        return [
            '.stronger { font-weight: bold }'
        ];
    }
}

window.customElements.define('demo-component', DemoComponent);
```

### If binding

```javascript
class DemoComponent extends CustomElement {
    constructor() {
        super();

        this.show = true;
    }

    toggle(value) {
        this.update({ show: value });
    }

    static get template() {
        return `
            <h2>Demo</h2>
            <hr>

            <h3>If binding</h3>
            <button (click)="this.toggle(true)">Show</button>
            <button (click)="this.toggle(false)">Hide</button>

            <!-- use #if attribute to make a condition -->
            <p #if="this.show">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
        `;
    }
}

window.customElements.define('demo-component', DemoComponent);
```

### Attribute binding

```javascript
class ColorComponent extends CustomElement {
    constructor() {
        super();
        this.color = '#fff';
    }

    /**
     * Call every time observed attribute change
     */
    onChanges(attributeName, oldValue, newValue) {
        if ('color' === attributeName) {
            // this.color is already set with new value, but you can abort and set the old value

            this.update();
        }
    }

    // Define ouputs
    static get observedAttributes() {
        return ['color'];
    }

    static get template() {
        return '<span [style.background]="this.color" [innerHTML]="this.color"></span>';
    }
}

class DemoComponent extends CustomElement {
    constructor() {
        super();

        this.color = '#000';
    }

    onConnected() {
        this.el('input[name=color]').on('change', event => {
            this.update({ color: event.target.value });
        });
    }

    static get template() {
        return `
            <h2>Demo</h2>
            <hr>

            <h3>Attribute binding</h3>
            <label [style.color]="this.color">Choose your color</label>
            <input [value]="this.color" type="color" name="color">

            <h5>Sub component</h5>
            <!-- use another custom component with outputs -->
            <color-component [attr.color]="this.color"></color-component>
        `;
    }
}

window.customElements.define('color-component', ColorComponent);
window.customElements.define('demo-component', DemoComponent);
```

### Container and Injectable services

```javascript
class Http {
    get(url) {
        return fetch(url).then(result => result.text());
    }
}

class MarkdownDecoder {
    constructor() {
        this.converter = new showdown.Converter();
    }

    decode(markdown) {
        return this.converter.makeHtml(markdown);
    }
}

// Define class is injectable in another class with injects() static method
class ReadmeLoader extends Injectable {
    constructor(http, markdownDecoder) {
        super();

        this.http = http;
        this.decoder = markdownDecoder;
    }

    load(url) {
        return this.http.get(url).then(data => this.decoder.decode(data));
    }

    static get injects() {
        return [Http, MarkdownDecoder]; // Another services
    }
}

class ReadmeComponent extends CustomElement {
    constructor() {
        super();

        this.url = 'https://raw.githubusercontent.com/kevinbalicot/custom-element/master/README.md';
        this.readmeLoader = this.get('ReadmeLoader');

        this.content = null;
    }

    onConnected() {
        this.readmeLoader.load(this.url).then(content => {
            this.update({ content });
        });
    }

    static get template() {
        return '<div [innerHTML]="this.content"></div>';
    }

    static get injects() {
        return [Http, MarkdownDecoder, ReadmeLoader]; // Need to inject all services
    }
}
```

### Event binding

Sometime to use `AddEventListener` into `onConnected` can't work after the template refreshing, because target element is not the same after the refresh. So instead of `AddEventListener`, please use event binding.

```javascript
class MyComponent extends CustomElement {

    onClick(event) {
        // No need to use event.stopPropagation() with (*.stop)
        // make something with button
    }

    onInput(event) {
        // make something with input
    }

    onSumbit(event) {
        // No need to use event.preventDefault() with (*.prevent)
        // make something with form
    }

    onSelect(event) {
        // make something with select
    }

    static get template() {
        return `
            <button (click.stop)="this.onClick($event)">Click on me <3</button>

            <form (submit.prevent)="this.onSumbit($event)">
                <input (input)="this.onInput($event)" type="text" name="text">
                <select (change)="this.onSelect($event)">
                    <option value="1">One</option>
                    <option value="2">Two</option>
                    <option value="3">Three</option>
                </select>
            </form>
        `;
    }
}
```
### Slots

You can use slot system, explanation on [MDN web doc](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_templates_and_slots).

```javascript
class ChildComponent extends CustomElement {
    constructor() {
        super();
        this.childParam = 'child';
    }
   
    static get template() {
        return `
            <span [innerHTML]="this.childParam"></span>
            <slot name="title">Default title</slot>
            <slot>Default content</slot>
        `;
    }
}

window.customElements.define('child-component', ChildComponent);

class ParentComponent extends CustomElement {
    static get template() {
        return `
            <child-component>
                <h4 slot="title">Override default title of child component</h4>
                <ul>
                    <li>Override default content of child component</li>
                    <li>Can get child scope <span [innerHTML]="this.childParam"></span></li>
                    <li>But we can always get parent scope <span [innerHTML]="parent.parentParam"></span></li>
                </ul>
            </child-component>
        `;
    }
}

window.customElements.define('parent-component', ChildComponent);
```

## API

```javascript
class CustomElement extends HTMLElement {
    constructor() {}

    connectedCallback() {
        // Call this.onConnected()
    }

    /**
     * @param {string} name - Attribute name
     * @param {string|number} oldValue - old attribute value
     * @param {string|number} newValue - new attribute value
     */
    attributeChangedCallback(name, oldValue, newValue) {
        // Call this.onChanges()
    }

    disconnectedCallback() {
        // Call this.onDisconnected()
    }

    /**
     * @param {Object} [details={}] - this attributes to update
     */
    update(details = {}) {}

    /**
     * @param {string} key - Get element into container
     * @return {*}
     */
    get(key) {}

    /**
     * @param {string} key - Key of element to store into container
     * @param {*} value - Element to store into container
     * @param {Array<*>} [parameters=[]] - Parameters to inject into element constructor
     */
    set(key, value, parameters = []) {}

    /**
     * @param {string} key - Element key into container
     * @return {boolean}
     */
    has(key) {}

    /**
     * @param {string} event - Event name to attach at this custom element
     * @param {function} callback
     * @param {boolean} [options=false] - Option for AddEventListener function
     */
    on(event, callback, options = false) {}

    /**
     * @param {string} selector - CSS selector to get HTML Element
     * @param {HTMLElement|null}
     */
    el(selector) {}

    /**
     * @param {string} selector - CSS selector to get a list of HTML Elements
     * @param {Array<HTMLElement>|[]}
     */
    all(selector) {}

    /**
     * @param {string} event - Event name to emit from this custom element
     */
    emit(event) {}

    static get template() {
        return '<slot></slot>';
    }

    static get injects() {
        return [];
    }

    static get observedAttributes() {
        return [];
    }

    static get styles() {
        return [];
    }
}

class Injectable {
	static get injects() {
		return [];
	}
}
```
