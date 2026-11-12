"""Write a model page's display equations as MathML that every current browser draws the same way.

Each model's About tab shows its equations (see models/README.md). Browsers draw MathML themselves, so the page
needs no outside library. But MathML written the short way goes wrong in four places, and these helpers avoid
them:

- Letters. A bare <mi>x</mi> asks for a letter from Unicode's mathematical alphabets, and Android has no font
  with those. So every letter is written <mi mathvariant="normal">x</mi>, and the page's style sheet sets those
  in italics from an ordinary serif font.
- Spaces. MathML puts no space after sin, cos, tan or ln, and none between factors written side by side. So a thin
  <mspace> follows each function name and each silent multiplication. (An <mspace> is used, not the rspace
  attribute, because browsers differ on spacing around invisible operators.) Browsers also give a slash as
  much room as a plus sign, so slash() closes up the one in a/r.
- Brackets. They are marked stretchy="false", so they stay the size of the text around them.
- Place on the page. Each equation is written <math displaystyle="true">, not <math display="block">, and sits
  in the page's own left-aligned box (class "eq"). Browsers centre display="block" maths, each in its own way,
  and a centred equation that is wider than a phone's screen is cut off on the left, where no one can scroll
  to it. Written this way, a wide equation scrolls sideways from its start.

How a model uses it: the equations live in models/<name>/equations.py (models/milankovitch/equations.py is the
pattern), and web/index.html marks each one's place with <div class="eq" data-eq="its-name"></div>.

    python3 models/<name>/equations.py            print the MathML
    python3 models/<name>/equations.py --write    put it into web/index.html
    python3 models/<name>/equations.py --check    fail if web/index.html is out of date (the model's tests run this)

The page in Git is still the whole page: nothing is built when the site is published.

The equations on a page are claims about its model, so the model's tests hold them to its code. in_page()
reads the equations back out of the page, and sides() works out the two sides of one as numbers. Given the
model's own numbers for the letters, the two sides must agree (tests/test_milankovitch_model.py is the pattern).
"""
import math
import re
import sys
import xml.etree.ElementTree as ET

THIN = '<mspace width="0.17em"/>'
APPLY = '<mo>&#x2061;</mo>' + THIN       # "function of": sin x
TIMES = '<mo>&#x2062;</mo>' + THIN       # silent multiplication: a b
FUNCTIONS = {'sin': math.sin, 'cos': math.cos, 'tan': math.tan, 'ln': math.log}


def var(letter):
    """A one-letter quantity, Latin or Greek: var('e'), var('λ')."""
    if len(letter) != 1:
        raise ValueError('var() takes one letter; use fn() for a name like sin: %r' % letter)
    return '<mi mathvariant="normal">%s</mi>' % letter


def num(text):
    """A number, with its degree sign if it has one: num('180°')."""
    return '<mn>%s</mn>' % text


def op(sign):
    """A sign between two things: op('='), op('+'), op('−')."""
    return '<mo>%s</mo>' % sign


def row(*parts):
    return '<mrow>' + ''.join(parts) + '</mrow>'


def fn(name, argument):
    """A named function of something: fn('cos', var('θ')), fn('ln', num('2')). ln is the natural logarithm."""
    return row('<mi>%s</mi>' % name, APPLY, argument)


def times(*factors):
    """Factors written side by side."""
    return TIMES.join(factors)


def frac(top, bottom):
    return '<mfrac>%s%s</mfrac>' % (top, bottom)


def power(base, exponent):
    return '<msup>%s%s</msup>' % (base, exponent)


def sub(base, index):
    return '<msub>%s%s</msub>' % (base, index)


def brackets(*parts):
    return row('<mo stretchy="false">(</mo>', *parts, '<mo stretchy="false">)</mo>')


def slash(top, bottom):
    """One thing over another on a single line, with the slash set close: slash(var('a'), var('r')) is a/r."""
    return row(top, '<mo lspace="0" rspace="0">/</mo>', bottom)


def negative(*parts):
    """A minus sign in front of something. On its own row, so it sits close to what it negates."""
    return row('<mo form="prefix">−</mo>', *parts)


def delta(quantity):
    """A change in something, or one step of it: delta(var('t')) is Δt. The Δ stands upright, close to its letter."""
    return row('<mo lspace="0" rspace="0">Δ</mo>', quantity)


def equation(*parts):
    """One display equation. Raises if the result isn't well formed."""
    text = '<math displaystyle="true">' + row(*parts) + '</math>'
    ET.fromstring(text)
    return text


PLACE = '<div class="eq" data-eq="%s">'


def placed(page_text, equations):
    """The page's text with each equation put in its place. Every name must be used exactly once."""
    marked = re.findall(r'<div class="eq" data-eq="([^"]*)">', page_text)
    if sorted(marked) != sorted(equations):
        raise SystemExit('The equations and the places marked for them in the page differ.\n  equations: %s\n  page:      %s'
                         % (', '.join(sorted(equations)), ', '.join(sorted(marked))))
    for name, mathml in equations.items():
        pattern = re.compile(re.escape(PLACE % name) + r'.*?</div>', re.S)
        page_text = pattern.sub(lambda match: PLACE % name + mathml + '</div>', page_text)
    return page_text


def in_page(page_text):
    """The equations in a page, by name, in the order they come."""
    return dict(re.findall(r'<div class="eq" data-eq="([^"]*)">(.*?)</div>', page_text, re.S))


def sides(equation_text, values):
    """The two sides of an equation written with these helpers, worked out as numbers.

    `values` gives a number for each letter, and for a letter with a subscript under the two together:
    {'θ': 3.44, 'e': 0.0167, 'h0': 2.48}. A change written with delta() is looked up with its Δ: 'Δt', 'Δz1'.
    Angles are in radians, and 180° is read as π.
    """
    (top,) = ET.fromstring(equation_text)
    parts = list(top)
    equals = [place for place, part in enumerate(parts) if part.tag == 'mo' and part.text == '=']
    if len(equals) != 1:
        raise ValueError('an equation needs one equals sign')
    values = {'π': math.pi, **values}
    return _Sum(parts[:equals[0]], values).whole(), _Sum(parts[equals[0] + 1:], values).whole()


class _Sum:
    """Reads a run of MathML elements as arithmetic: terms added, factors multiplied, functions applied."""

    def __init__(self, parts, values):
        self.parts = [part for part in parts if part.tag != 'mspace']
        self.values = values

    def whole(self):
        value = self.total()
        if self.parts:
            raise ValueError('cannot read what follows: ' + ET.tostring(self.parts[0], encoding='unicode'))
        return value

    def sign(self, *signs):
        """Take the next element if it is one of these signs."""
        if self.parts and self.parts[0].tag == 'mo' and self.parts[0].text in signs:
            return self.parts.pop(0).text
        return None

    def total(self):
        value = self.product()
        while True:
            sign = self.sign('+', '−')
            if sign is None:
                return value
            value = value + self.product() if sign == '+' else value - self.product()

    def product(self):
        value = self.factor()
        while True:
            sign = self.sign('\u2062', '/')
            if sign is None:
                return value
            value = value * self.factor() if sign == '\u2062' else value / self.factor()

    def factor(self):
        if self.sign('−'):
            return -self.factor()
        if self.sign('('):
            value = self.total()
            if not self.sign(')'):
                raise ValueError('a bracket is not closed')
            return value
        if self.sign('Δ'):
            if not self.parts or self.parts[0].tag not in ('mi', 'msub'):
                raise ValueError('Δ needs a letter after it')
            return self.values['Δ' + ''.join(self.parts.pop(0).itertext())]
        if not self.parts:
            raise ValueError('something is missing at the end')
        part = self.parts.pop(0)
        if part.tag == 'mn':
            number = part.text.replace(',', '')
            return math.radians(float(number[:-1])) if number.endswith('°') else float(number)
        if part.tag == 'mi' and part.text in FUNCTIONS:
            if not self.sign('\u2061'):
                raise ValueError('%s has nothing to work on' % part.text)
            return FUNCTIONS[part.text](self.factor())
        if part.tag == 'mi':
            return self.values[part.text]
        if part.tag == 'msub':
            return self.values[''.join(child.text for child in part)]
        if part.tag == 'mrow':
            return _Sum(list(part), self.values).whole()
        if part.tag in ('mfrac', 'msup'):
            first, second = (_Sum([child], self.values).whole() for child in part)
            return first / second if part.tag == 'mfrac' else first ** second
        raise ValueError('cannot read ' + ET.tostring(part, encoding='unicode'))


def main(equations, page, arguments=None):
    """The command line for a model's equations.py. `page` is the path of its web/index.html."""
    arguments = sys.argv[1:] if arguments is None else arguments
    if not arguments:
        for name, mathml in equations.items():
            print(name, mathml, '', sep='\n')
        return
    if arguments not in (['--write'], ['--check']):
        raise SystemExit('usage: equations.py [--write | --check]')
    old = page.read_text(encoding='utf-8')
    new = placed(old, equations)
    if arguments == ['--write']:
        if new != old:
            page.write_text(new, encoding='utf-8')
        print('%s: %d equations %s' % (page.name, len(equations), 'written' if new != old else 'already up to date'))
    elif new != old:
        raise SystemExit('%s is out of date with its equations. Run this script with --write.' % page)
