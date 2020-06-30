const assert = require('assert');
const { JSDOM } = require('jsdom-wc');

const callers = {
    onConnected: 0,
    onChanges: 0,
    onDisconnected: 0
};
const dom = new JSDOM('', { runScripts: 'dangerously' });
const window = dom.window;

Object.assign(global, {
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLTemplateElement: window.HTMLTemplateElement,
    customElements: window.customElements,
    CustomEvent: window.CustomEvent,
    window,
});

const CustomElement = require('./../src/custom-element');

class MyComponent extends CustomElement {
    constructor() {
        super();

        this.text = 'My webpage';
        this.info = false;
        this.items = [];
        this.object = {};
        this.clicks = 0;

        this.attrs = {
            color: 'blue',
            title: 'Hello!',
            className: 'some-class',
            classToto: true,
            width: 10,
            height: 50
        };
    }

    onConnected() {
        callers.onConnected++;
    }

    onChanges() {
        callers.onChanges++;
    }

    onDisconnected() {
        callers.onDisconnected++;
    }

    static get template() {
        return `
            <h1>Hello world</h1>
            <div id="div" [innerHTML]="this.text"></div>
            <p #if="this.info">My information banner</p>
            <ul>
                <li #for="let i of this.items" [attr.index]="$index" [innerHTML]="i"></li>
            </ul>
            <ol>
                <li #for="let key in this.object" [attr.value]="$prop" [innerHTML]="key"></li>
            </ol>
            <button (click)="this.clicks++">Click here</button>
            <a href="">Click on my link</a>

            <strong class="update-me-same-time" [innerHTML]="this.text"></strong>
            <i class="update-me-same-time" [innerHTML]="this.text"></i>

            <div id="change-attributes"
                [style.color]="this.attrs.color"
                [title]="this.attrs.title"
                [className]="this.attrs.className"
                [class.toto]="this.attrs.classToto"
                [style.width.px]="this.attrs.width"
                [style.height.%]="this.attrs.height">
            </div>
        `;
    }

    static get styles() {
        return ['h1 { color: red; }'];
    }

    static get observedAttributes() {
        return ['foo'];
    }
}

describe('Custom Element', () => {
    before(() => {
        window.customElements.define('my-component', MyComponent);
        window.document.body.innerHTML = '<my-component></my-component>';
    });

    it('should be initialize with content', () => {
        const element = window.document.querySelector('my-component');

        assert.strictEqual(element instanceof CustomElement, true);

        assert.strictEqual(callers.onConnected, 1);
        assert.strictEqual(callers.onChanges, 0);
        assert.strictEqual(callers.onDisconnected, 0);

        assert.strictEqual(element.el('h1').innerHTML, 'Hello world');
        assert.strictEqual(element.el('div').innerHTML, element.text);
    });

    it('should be initialize with styles', () => {
        const element = window.document.querySelector('my-component');

        assert(element.el('style'));
        assert(element.el('style').textContent);
    });

    it('should be able to change attributes of element', () => {
        const element = window.document.querySelector('my-component');
        const div = element.el('#change-attributes');

        assert.strictEqual(div.style.color, element.attrs.color);
        assert.strictEqual(div.title, element.attrs.title);
        assert.strictEqual(div.className, element.attrs.className + ' toto');
        assert.strictEqual(div.classList.contains('toto'), true);
        assert.strictEqual(div.style.width, element.attrs.width + 'px');
        assert.strictEqual(div.style.height, element.attrs.height + '%');

        const expected = {
            color: 'red',
            title: 'Hello you <3',
            className: 'other-some-class',
            classToto: false,
            width: 50,
            height: 10
        };

        element.attrs = expected;
        element.update();

        assert.strictEqual(div.style.color, expected.color);
        assert.strictEqual(div.title, expected.title);
        assert.strictEqual(div.className, expected.className);
        assert.strictEqual(div.classList.contains('toto'), false);
        assert.strictEqual(div.style.width, expected.width + 'px');
        assert.strictEqual(div.style.height, expected.height + '%');
    });

    it('should be able to get one element', () => {
        const element = window.document.querySelector('my-component');

        assert.strictEqual(element.el('h1').tagName, 'H1');
        assert.strictEqual(element.el('#div').tagName, 'DIV');
        assert.strictEqual(element.el('.update-me-same-time').tagName, 'STRONG');
    });

    it('should be able to get some elements', () => {
        const element = window.document.querySelector('my-component');
        const elements = element.all('.update-me-same-time');
        const expected = ['STRONG', 'I'];

        elements.forEach((el, index) => assert.strictEqual(el.tagName, expected[index]));
    });

    it('should be able to update content', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'I changed my webpage.';

        assert.strictEqual(element.el('div').innerHTML, element.text);

        element.text = expected;
        element.update();

        assert.strictEqual(element.el('div').innerHTML, expected);
    });

    it('should be able to update content with details', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'Another text.';

        element.update({ text: expected });

        assert.strictEqual(element.el('div').innerHTML, expected);
        assert.strictEqual(element.text, expected);
    });

    it('should be able to update some elements', () => {
        const init = 'some text';
        const expected = 'I changed my text.';

        // reinit
        const element = window.document.querySelector('my-component');
        element.text = init;
        element.update();

        assert.strictEqual(element.el('strong').innerHTML, element.text);
        assert.strictEqual(element.el('i').innerHTML, element.text);

        element.text = expected;
        element.update();

        assert.strictEqual(element.el('strong').innerHTML, expected);
        assert.strictEqual(element.el('i').innerHTML, expected);
        assert.strictEqual(element.el('div').innerHTML, expected);
    });

    it('should be able to change observed attributes', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'bar';
        const expected2 = '{ "foo": "bar" }';

        assert.strictEqual(element.getAttribute('foo'), null);

        element.setAttribute('foo', expected);

        assert.strictEqual(callers.onChanges, 1);
        assert.strictEqual(element.getAttribute('foo'), expected);
        assert.strictEqual(element.foo, expected);

        element.setAttribute('foo', expected2);

        assert.strictEqual(callers.onChanges, 2);
        assert.strictEqual(element.getAttribute('foo'), expected2);
        assert.strictEqual(typeof element.foo === 'object', true);
        assert.strictEqual(element.foo.foo, JSON.parse(expected2).foo);
    });

    it('should be able to display or remove HTML element with #if', () => {
        const element = window.document.querySelector('my-component');

        assert(!element.el('p'));

        element.info = true;
        element.update();

        assert(element.el('p'));
    });

    it('should be able to add or remove HTML elements with #for', () => {
        const element = window.document.querySelector('my-component');
        const expected = 1;

        assert.strictEqual(element.el('ul').children.length, 0);

        element.items.push(expected);
        element.update();

        assert.strictEqual(element.el('ul').children.length, 1);
        assert.strictEqual(element.el('ul').children[0].innerHTML, String(expected));
        assert.strictEqual(element.el('ul').children[0].getAttribute('index'), String(0));

        [1,2,3,4,5].forEach(i => {
            element.items.push(i);
            assert.strictEqual(element.el('ul').children.length, element.items.length - 1);
            element.update();
            assert.strictEqual(element.el('ul').children.length, element.items.length);
        });

        element.items.splice(0, 1);
        assert.strictEqual(element.el('ul').children.length, element.items.length + 1);
        element.update();
        assert.strictEqual(element.el('ul').children.length, element.items.length);
    });

    it('should be able to add or remove object parameter with #for', () => {
        const element = window.document.querySelector('my-component');
        const expectedKey = 'foo';
        const expectedValue = 'bar';

        assert.strictEqual(element.el('ol').children.length, 0);

        element.object[expectedKey] = expectedValue;
        element.update();

        assert.strictEqual(element.el('ol').children.length, 1);
        assert.strictEqual(element.el('ol').children[0].innerHTML, String(expectedKey));
        assert.strictEqual(element.el('ol').children[0].getAttribute('value'), String(expectedValue));

        [
            { k: "1", v: "a" },
            { k: "2", v: "b" },
            { k: "3", v: "c" },
            { k: "4", v: "d" }
        ].forEach(i => {
            element.object[i.k] = i.v;
            assert.strictEqual(element.el('ol').children.length, Object.keys(element.object).length - 1);
            element.update();
            assert.strictEqual(element.el('ol').children.length, Object.keys(element.object).length);
        });
    });

    it('should be able to add events listeners with method and into template', done => {
        const element = window.document.querySelector('my-component');

        assert.strictEqual(element.clicks, 0);

        element.el('a').on('click', event => {
            assert.deepStrictEqual(element.el('a'), event.target);
            done();
        });

        element.el('button').click();
        assert.strictEqual(element.clicks, 1);
        element.el('a').click();
    });
});
