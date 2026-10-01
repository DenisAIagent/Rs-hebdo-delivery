import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReviewBoxMeta, hasReviewBox, missingEditorialMeta,
  REVIEW_TEMPLATE_CINEMA, REVIEW_TEMPLATE_MUSIC, WP_META_MAIN_ARTIST, WP_META_REVIEWS, WP_META_STYLE_MUSIC,
} from './wordpressReviewBox';

test('buildReviewBoxMeta reproduit la structure Reviewer de la rédaction', () => {
  const [box] = buildReviewBoxMeta({ score: 3.5, kind: 'musique', imageUrl: 'https://x/img.jpg' });
  assert.equal(box.review_template, REVIEW_TEMPLATE_MUSIC);
  assert.deepEqual(box.review_scores, [3.5]);
  assert.equal(box.review_title, "L'avis de la rédaction");
  assert.equal(box.review_image, 'https://x/img.jpg');
  assert.equal(box.review_disable_user_rating, 'yes');
  const [cine] = buildReviewBoxMeta({ score: 4.2, kind: 'cinema' });
  assert.equal(cine.review_template, REVIEW_TEMPLATE_CINEMA);
  assert.deepEqual(cine.review_scores, [4]);
});

test('hasReviewBox : vide, tableau vide ou box remplie', () => {
  assert.equal(hasReviewBox(undefined), false);
  assert.equal(hasReviewBox([[]]), false);
  assert.equal(hasReviewBox([[{ review_scores: [4] }]]), true);
});

test('missingEditorialMeta n’écrase jamais une saisie manuelle', () => {
  const filled = { [WP_META_REVIEWS]: [[{ review_scores: [3] }]], [WP_META_MAIN_ARTIST]: ['fat dog'], [WP_META_STYLE_MUSIC]: ['25'] };
  assert.deepEqual(missingEditorialMeta({ existing: filled, reviewBox: { score: 4, kind: 'musique' }, mainArtist: 'Fat Dog', styleMusicValue: '23' }), {});
  const empty = { [WP_META_REVIEWS]: [[]], [WP_META_MAIN_ARTIST]: [''] };
  const out = missingEditorialMeta({ existing: empty, reviewBox: { score: 4, kind: 'musique' }, mainArtist: 'Fat Dog', styleMusicValue: '25' });
  assert.deepEqual(Object.keys(out).sort(), ['_mat_other_value', '_mat_value', '_tsm_value', 'rwp_reviews']);
  assert.equal(out._mat_value, 'Fat Dog');
  assert.equal(out._tsm_value, '25');
});
