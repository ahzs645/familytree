import { describe, expect, it } from 'vitest';
import { parseGeneWebWikiLinks } from './wikiLinks.js';

describe('GeneWeb wiki links', () => {
  it.each([
    ['[[[aaa/bbb]]]', [page(13, [], 'aaa', 'aaa', '', 'bbb')]],
    ['[[[aaa#b_2/ccc]]]', [page(17, [], 'aaa', 'aaa', 'b_2', 'ccc')]],
    ['[[[Sources:Index#a_2/sources]]]', [page(31, ['Sources'], 'Index', 'Sources:Index', 'a_2', 'sources')]],
    ['[[ccc/ddd]]', [person(11, 'ccc', 'ddd', 0, 'ccc ddd')]],
    ['[[ccc/ddd/Texte]]', [person(17, 'ccc', 'ddd', 0, 'Texte')]],
    ['[[ccc/ddd/1/Ccc Ddd]]', [person(21, 'ccc', 'ddd', 1, 'Ccc Ddd')]],
    ['[[ccc/ddd/Texte;Texte 2]]', [person(25, 'ccc', 'ddd', 0, 'Texte', 'Texte 2')]],
    ['[[ccc/ddd]]#1', [person(13, 'ccc', 'ddd', 0, 'ccc ddd', null, 1)]],
    ['[[ccc/ddd]]#42', [person(14, 'ccc', 'ddd', 0, 'ccc ddd', null, 42)]],
    ['[[ccc/ddd;txt]]#5', [person(17, 'ccc', 'ddd', 0, 'ccc ddd', 'txt', 5)]],
    ['[[[]]]', [none(6, '[[[]]]')]],
    ['[[]]', [none(4, '[[]]')]],
    ['[[w', [none(3, '[[w')]],
    ['[[[d_azincourt/d&#039;Azincourt]]]', [page(34, [], 'd_azincourt', 'd_azincourt', '', 'd&#039;Azincourt')]],
    [
      '[[[aaa/bbb]], [[ccc/ddd/Ccc Ddd]], http://site.com/eee#fff',
      [
        none(1, '['),
        person(12, 'aaa', 'bbb', 0, 'aaa bbb'),
        none(14, ', '),
        person(33, 'ccc', 'ddd', 0, 'Ccc Ddd'),
        none(58, ', http://site.com/eee#fff'),
      ],
    ],
    ['[[[aaa/', [none(1, '['), none(7, '[[aaa/')]],
    ['[[[w', [none(1, '['), none(4, '[[w')]],
    ['[[w:hg]]', [wizard(8, 'hg', '')]],
    ['[[w:hg/henri]]', [wizard(14, 'hg', 'henri')]],
    ['[[[[w:hg/henri]]', [none(1, '['), none(2, '['), wizard(16, 'hg', 'henri')]],
    ['[[image:photo.jpg]]', [image(19, [], 'photo.jpg', '', null)]],
    ['[[image:albums:pic.jpg]]', [image(24, ['albums'], 'pic.jpg', '', null)]],
    ['[[image:photo.jpg/my photo]]', [image(28, [], 'photo.jpg', 'my photo', null)]],
    ['[[image:photo.jpg/my photo/200px]]', [image(34, [], 'photo.jpg', 'my photo', '200px')]],
    ['[[image:photo.jpg/my photo/]]', [image(29, [], 'photo.jpg', 'my photo', null)]],
    ['[[image:bad path.jpg]]', [none(22, '[[image:bad path.jpg]]')]],
    ['[[image:a:b:c.jpg/t]]', [image(21, ['a', 'b'], 'c.jpg', 't', null)]],
  ])('parses %s', (input, expected) => {
    expect(parseGeneWebWikiLinks(input)).toEqual(expected);
  });
});

function none(end, text) {
  return { type: 'none', end, text };
}

function page(end, dirs, fileName, full, anchor, text) {
  return { type: 'page', end, path: { dirs, fileName }, full, anchor, text };
}

function person(end, firstName, surname, occurrence, name, text = null, familyMarker = null) {
  return {
    type: 'person',
    end,
    key: { firstName, surname, occurrence },
    name,
    text,
    familyMarker,
  };
}

function wizard(end, wizard, name) {
  return { type: 'wizard', end, wizard, name };
}

function image(end, dirs, fileName, alt, width) {
  return { type: 'image', end, path: { dirs, fileName }, alt, width };
}

