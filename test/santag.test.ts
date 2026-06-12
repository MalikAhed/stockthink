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

  it('keeps pawn moves and castling text intact', () => {
    const html = renderRich('You play e4.', [START]);
    expect(html).toContain('/wp.png');
    expect(html).toContain('>e4</span>');
  });

  it('leaves square mentions and illegal tokens as plain text', () => {
    // f6 is no legal white pawn move here? it is (f2-f4/f3...) — use a busy
    // sentence where the square is occupied: e2 can never be a pawn move
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
