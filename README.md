# Custom Element

Tiny library to make custom HTML elements

Live demo [https://jsfiddle.net/kevinbalicot/L08q4k21/](https://jsfiddle.net/kevinbalicot/L08q4k21/)

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

    <script src="/node_modules/@kevinbalicot/custom-element/dist/custom-element.js" charset="utf-8"></script>
</head>
<body>
    <my-component></my-component>

    <script>
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
    * Call when custom element call connectedCallback (see custom element life cycle)
    */
    onConnected() {
        this.element('input[name=text]').on('keyup', event => {
            this.text = event.target.value;
            this.update();
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

                this.update('ul');
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
        this.show = value;
        this.update();
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
        this.element('input[name=color]').on('change', event => {
            this.color = event.target.value;
            this.update();
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
window.customElements.define('home-component', HomeComponent);
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

// Define class is injectable in another class with injects() static
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
        return [Http, MarkdownDecoder];
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
            this.content = content;
            this.update();
        });
    }

    static get template() {
        return '<div [innerHTML]="this.content"></div>';
    }

    static get injects() {
        return [Http, MarkdownDecoder, ReadmeLoader];
    }
}
```

### Routing

```javascript
class HomeComponent extends CustomElement {
    constructor() {
        super();

        this.router = this.get('Router');
    }

    onConnected() {
        this.router.add([
            { path: '/', component: 'readme-component', container: this.element('#view-container') },
            { path: '/demo', component: 'demo-component', container: this.element('#view-container') },
            { path: '/about', component: 'about-component', container: this.element('#view-container') }
        ]);
    }

    static get template() {
        return '<div id="view-container"></div>';
    }

    static get injects() {
        return [Router];
    }
}

window.customElements.define('home-component', HomeComponent);
```
