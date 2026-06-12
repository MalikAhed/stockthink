/**
 * Rich move tags — SAN tokens become piece-image pills only when they parse
 * as legal moves in a candidate position; square mentions stay plain.
 */
import { describe, expect, it } from 'vitest';
import { renderRich } from '../src/ui/santag';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('renderRich', () => {
  it('tags a legal piece move with the right piece image and strips the letter', () => {
    const html = renderRich('Nf3 was the better way.', [START]);
    expect(html).toContain('san-tag white');
    expect(html).toContain('/wn.png');
    expect(html).toContain('>f3</span>');
    expect(html).not.toContain('>Nf3<');
  });

  it('tags castling', () => {
    const afterSetup = 'rnbqk2r/ppppbppp/5n2/4p3/4P3/5N2/PPPPBPPP/RNBQK2R w KQkq - 4 4';
    const html = renderRich('Now O-O brings the king to safety.', [afterSetup]);
    expect(html).toContain('san-tag');
    expect(html).toContain('/wk.png');
  });

  it('never tags a bare square — coordinates are not pawn pills', () => {
    // the core bug: "the knight goes to c6" must not stamp a pawn pill on c6
    // even though c6 parses as a legal pawn move in many positions
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const html = renderRich('the knight goes to c6 next', [afterE4]);
    expect(html).not.toContain('san-tag');
    expect(html).toContain('c6');
  });

  it('a bare pawn push is left plain (ambiguous with a coordinate)', () => {
    const html = renderRich('You play e4.', [START]);
    expect(html).not.toContain('san-tag');
  });

  it('still tags a pawn capture (unambiguous SAN)', () => {
    const afterE4d5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
    const html = renderRich('exd5 opens the center.', [afterE4d5]);
    expect(html).toContain('san-tag');
    expect(html).toContain('/wp.png');
  });

  it('leaves square mentions and illegal tokens as plain text', () => {
    const html = renderRich('the rook had a job covering e2 here', [START]);
    expect(html).not.toContain('san-tag');
  });

  it('parses against multiple candidate positions (replies use the after-fen)', () => {
    const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const html = renderRich('Nf6 answers e4.', [START, afterE4]);
    expect(html).toContain('/bn.png'); // black knight parsed in the reply position
  });

  it('escapes HTML in the surrounding text', () => {
    expect(renderRich('<b>Nf3</b>', [START])).not.toContain('<b>');
  });
});
