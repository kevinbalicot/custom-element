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
    customElements: window.customElements,
    CustomEvent: window.CustomEvent,
    window,
});

const { CustomElement } = require('./../src/custom-element');

class MyComponent extends CustomElement {
    constructor() {
        super();

        this.text = 'My webpage';
        this.info = false;
        this.items = [];
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

    get template() {
        return `
            <h1>Hello world</h1>
            <div id="div" [innerHTML]="this.text"></div>
            <p #if="this.info">My information banner</p>
            <ul>
                <li #for="let i of this.items" [innerHTML]="i"></li>
            </ul>
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

        assert.equal(element instanceof CustomElement, true);

        assert.equal(callers.onConnected, 1);
        assert.equal(callers.onChanges, 0);
        assert.equal(callers.onDisconnected, 0);

        assert.equal(element.element('h1').innerHTML, 'Hello world');
        assert.equal(element.element('div').innerHTML, element.text);
    });

    it('should be initialize with styles', () => {
        const element = window.document.querySelector('my-component');

        assert(element.element('style'));
        assert(element.element('style').textContent);
    });

    it('should be able to change attributes of element', () => {
        const element = window.document.querySelector('my-component');
        const div = element.element('#change-attributes');

        assert.equal(div.style.color, element.attrs.color);
        assert.equal(div.title, element.attrs.title);
        assert.equal(div.className, element.attrs.className + ' toto');
        assert.equal(div.classList.contains('toto'), true);
        assert.equal(div.style.width, element.attrs.width + 'px');
        assert.equal(div.style.height, element.attrs.height + '%');

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

        assert.equal(div.style.color, expected.color);
        assert.equal(div.title, expected.title);
        assert.equal(div.className, expected.className);
        assert.equal(div.classList.contains('toto'), false);
        assert.equal(div.style.width, expected.width + 'px');
        assert.equal(div.style.height, expected.height + '%');
    });

    it('should be able to get one element', () => {
        const element = window.document.querySelector('my-component');

        assert.equal(element.element('h1').tagName, 'H1');
        assert.equal(element.element('#div').tagName, 'DIV');
        assert.equal(element.element('.update-me-same-time').tagName, 'STRONG');
    });

    it('should be able to get some elements', () => {
        const element = window.document.querySelector('my-component');
        const elements = element.elementAll('.update-me-same-time');
        const expected = ['STRONG', 'I'];

        elements.forEach((el, index) => assert.equal(el.tagName, expected[index]));
    });

    it('should be able to update content', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'I changed my webpage.';

        assert.equal(element.element('div').innerHTML, element.text);

        element.text = expected;
        element.update();

        assert.equal(element.element('div').innerHTML, expected);
    });

    it('should be able to update content with details', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'Another text.';

        element.update({ text: expected });

        assert.equal(element.element('div').innerHTML, expected);
        assert.equal(element.text, expected);
    });

    it('should be able to update some elements', () => {
        const init = 'some text';
        const expected = 'I changed my text.';

        // reinit
        const element = window.document.querySelector('my-component');
        element.text = init;
        element.update();

        assert.equal(element.element('strong').innerHTML, element.text);
        assert.equal(element.element('i').innerHTML, element.text);

        element.text = expected;
        element.update();

        assert.equal(element.element('strong').innerHTML, expected);
        assert.equal(element.element('i').innerHTML, expected);
        assert.equal(element.element('div').innerHTML, expected);
    });

    it('should be able to change observed attributes', () => {
        const element = window.document.querySelector('my-component');
        const expected = 'bar';
        const expected2 = '{ "foo": "bar" }';

        assert.strictEqual(element.getAttribute('foo'), null);

        element.setAttribute('foo', expected);

        assert.equal(callers.onChanges, 1);
        assert.strictEqual(element.getAttribute('foo'), expected);
        assert.strictEqual(element.foo, expected);

        element.setAttribute('foo', expected2);

        assert.equal(callers.onChanges, 2);
        assert.strictEqual(element.getAttribute('foo'), expected2);
        assert.equal(typeof element.foo === 'object', true);
        assert.strictEqual(element.foo.foo, JSON.parse(expected2).foo);
    });

    it('should be able to display or remove HTML element with #if', () => {
        const element = window.document.querySelector('my-component');

        assert(!element.element('p'));

        element.info = true;
        element.update();

        assert(element.element('p'));
    });

    it('should be able to add or remove HTML elements with #for', () => {
        const element = window.document.querySelector('my-component');
        const expected = 1;

        assert.equal(element.element('ul').children.length, 0);

        element.items.push(expected);
        element.update();

        assert.equal(element.element('ul').children.length, 1);
        assert.strictEqual(element.element('ul').children[0].innerHTML, String(expected));

        [1,2,3,4,5].forEach(i => {
            element.items.push(i);
            assert.equal(element.element('ul').children.length, element.items.length - 1);
            element.update();
            assert.equal(element.element('ul').children.length, element.items.length);
        });

        element.items.splice(0, 1);
        assert.equal(element.element('ul').children.length, element.items.length + 1);
        element.update();
        assert.equal(element.element('ul').children.length, element.items.length);
    });

    it('should be able to add events listeners with method and into template', done => {
        const element = window.document.querySelector('my-component');

        assert.equal(element.clicks, 0);

        element.element('a').on('click', event => {
            assert.deepEqual(element.element('a'), event.target);
            done();
        });

        element.element('button').click();
        assert.equal(element.clicks, 1);
        element.element('a').click();
    });
});
