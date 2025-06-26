export class DOMUtils {
    static createElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    }

    static getElementById(id) {
        return document.getElementById(id);
    }

    static querySelector(selector) {
        return document.querySelector(selector);
    }

    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    static show(element) {
        if (element) element.style.display = 'block';
    }

    static hide(element) {
        if (element) element.style.display = 'none';
    }

    static toggle(element) {
        if (!element) return;
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }

    static addClass(element, className) {
        if (element) element.classList.add(className);
    }

    static removeClass(element, className) {
        if (element) element.classList.remove(className);
    }

    static toggleClass(element, className) {
        if (element) element.classList.toggle(className);
    }

    static hasClass(element, className) {
        return element ? element.classList.contains(className) : false;
    }

    static setAttributes(element, attributes) {
        if (!element) return;
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    static removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    static clearChildren(element) {
        if (element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }
    }
}