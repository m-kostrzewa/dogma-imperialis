import React, { useState, useEffect, useContext } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getIdToken } from 'firebase/auth';
import { FirebaseContext } from './firebase';
import './thoughtBanner.css';

const TRIGGER_URL = 'https://europe-west3-dogma-imperialis.cloudfunctions.net/triggerDailyThought';

function getDateStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function ThoughtBanner() {
  const firebase = useContext(FirebaseContext);
  const [thought, setThought] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState('');

  // Track auth state
  useEffect(() => {
    const unsub = firebase.auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return unsub;
  }, [firebase]);

  // Fetch daily thought
  useEffect(() => {
    fetchThought();
  }, [firebase]);

  async function fetchThought() {
    try {
      const today = getDateStr(0);
      const todayDoc = await getDoc(doc(firebase.db, 'daily_thought', today));
      if (todayDoc.exists()) {
        setThought(todayDoc.data());
        setLoading(false);
        return;
      }

      // Fall back to yesterday
      const yesterday = getDateStr(-1);
      const yesterdayDoc = await getDoc(doc(firebase.db, 'daily_thought', yesterday));
      if (yesterdayDoc.exists()) {
        setThought(yesterdayDoc.data());
      }
    } catch (err) {
      console.warn('Failed to fetch daily thought:', err);
    }
    setLoading(false);
  }

  async function handleGeneratePreview() {
    if (generating || !currentUser) return;
    setGenerating(true);
    setGenError('');
    setPreview(null);

    try {
      const token = await getIdToken(currentUser);
      const resp = await fetch(`${TRIGGER_URL}?dryRun=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setPreview(data);
    } catch (err) {
      console.error('Generate preview failed:', err);
      setGenError(err.message);
    }
    setGenerating(false);
  }

  async function handleSave() {
    if (saving || !currentUser || !preview) return;
    setSaving(true);
    setGenError('');

    try {
      const token = await getIdToken(currentUser);
      const resp = await fetch(`${TRIGGER_URL}?save=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preview),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setThought(data);
      setPreview(null);
    } catch (err) {
      console.error('Save failed:', err);
      setGenError(err.message);
    }
    setSaving(false);
  }

  function handleDiscardPreview() {
    setPreview(null);
    setGenError('');
  }

  // Show mod controls even when there's no thought yet
  const isMod = currentUser && currentUser.uid === 'gmhoL3b4R1cRajWnAYBcm4vB9oX2';

  if (loading) return null;
  if (!thought && !isMod) return null;

  // Show the preview if one exists, otherwise the saved thought
  const display = preview || thought;
  const isPreview = !!preview;

  const hasHeadline = display?.headline && display?.headlineSource;
  const headlineDate = display?.date
    ? new Date(display.date + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <div className="thought-banner-wrapper">
      {display ? (
        <div
          className={`thought-banner ${expanded ? 'thought-banner--expanded' : ''} ${isPreview ? 'thought-banner--preview' : ''}`}
          onClick={() => setExpanded(!expanded)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        >
          {isPreview && <div className="thought-banner__preview-badge">PREVIEW</div>}

          <div className="thought-banner__header">
            &#x2629;&#xFE0E; THOUGHT FOR THE DAY &#x2629;&#xFE0E;
          </div>

          <blockquote className="thought-banner__quote">
            &ldquo;{display.quoteText}&rdquo;
          </blockquote>

          {display.quoteLoreSource && (
            <div
              className="thought-banner__attribution"
              dangerouslySetInnerHTML={{ __html: `&mdash; ${display.quoteLoreSource}` }}
            />
          )}

          {hasHeadline && (
            <div
              className={`thought-banner__headline ${expanded || isPreview ? 'thought-banner__headline--visible' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="thought-banner__headline-label">Inspired by: </span>
              {display.headlineUrl ? (
                <a
                  href={display.headlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="thought-banner__headline-link"
                >
                  &ldquo;{display.headline}&rdquo;
                </a>
              ) : (
                <>&ldquo;{display.headline}&rdquo;</>
              )}
              <span className="thought-banner__headline-source">
                {' '}&mdash; {display.headlineSource}
                {headlineDate ? `, ${headlineDate}` : ''}
              </span>
            </div>
          )}

          {isPreview && display.reasoning && (
            <div className="thought-banner__reasoning" onClick={(e) => e.stopPropagation()}>
              Reasoning: {display.reasoning}
            </div>
          )}
        </div>
      ) : (
        <div className="thought-banner thought-banner--empty">
          <div className="thought-banner__header">
            &#x2629;&#xFE0E; THOUGHT FOR THE DAY &#x2629;&#xFE0E;
          </div>
          <div className="thought-banner__attribution">No thought generated yet.</div>
        </div>
      )}

      {isMod && (
        <div className="thought-mod-controls">
          {isPreview ? (
            <>
              <button
                className="thought-regenerate thought-regenerate--save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '⟳ Saving...' : '✓ Save'}
              </button>
              <button
                className="thought-regenerate thought-regenerate--primary"
                onClick={handleGeneratePreview}
                disabled={generating}
              >
                {generating ? '⟳ Generating...' : '⟳ Generate another'}
              </button>
              <button
                className="thought-regenerate"
                onClick={handleDiscardPreview}
                disabled={generating || saving}
              >
                ✕ Discard
              </button>
            </>
          ) : (
            <button
              className="thought-regenerate thought-regenerate--primary"
              onClick={handleGeneratePreview}
              disabled={generating}
            >
              {generating ? '⟳ Generating...' : '⟳ Generate new (preview)'}
            </button>
          )}
          {genError && <div className="thought-mod-error">Error: {genError}</div>}
        </div>
      )}
    </div>
  );
}

export default ThoughtBanner;
