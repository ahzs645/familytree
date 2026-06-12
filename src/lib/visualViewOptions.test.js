import { describe, expect, it } from 'vitest';
import {
  buildChronologicalConnections,
  colorForVisualEvent,
  normalizeVisualViewOptions,
  updateVisualViewOption,
  usesHeatMap,
  usesMarkerPins,
} from './visualViewOptions.js';

describe('visual view options', () => {
  it('normalizes map display controls with bounded values', () => {
    const options = normalizeVisualViewOptions('mapStory', {
      markerMode: 'bad',
      colorBy: 'time',
      markerSize: 200,
      heatRadius: 1,
      heatOpacity: 5,
      slideshowDelayMs: 50,
      slideshowFit: true,
    });

    expect(options).toMatchObject({
      markerMode: 'pins',
      colorBy: 'time',
      markerSize: 24,
      heatRadius: 12,
      heatOpacity: 0.9,
      slideshowDelayMs: 600,
      slideshowFit: true,
    });
  });

  it('updates one option without dropping the rest of the model', () => {
    const options = updateVisualViewOption('globe', { markerMode: 'pins', markerSize: 10 }, 'markerMode', 'pins-heat');

    expect(options.markerMode).toBe('pins-heat');
    expect(options.markerSize).toBe(10);
    expect(usesMarkerPins(options)).toBe(true);
    expect(usesHeatMap(options)).toBe(true);
  });

  it('builds chronological connection segments from filtered events', () => {
    const connections = buildChronologicalConnections([
      { id: 'late', year: 1900, lat: 3, lng: 4 },
      { id: 'early', year: 1800, lat: 1, lng: 2 },
      { id: 'missing', year: 1850, lat: null, lng: 0 },
      { id: 'middle', year: 1850, lat: 2, lng: 3 },
    ], true);

    expect(connections).toEqual([
      { id: 'early-middle', from: { lng: 2, lat: 1 }, to: { lng: 3, lat: 2 } },
      { id: 'middle-late', from: { lng: 3, lat: 2 }, to: { lng: 4, lat: 3 } },
    ]);
  });

  it('colors event and time modes deterministically', () => {
    expect(colorForVisualEvent({ conclusionType: 'Birth' }, { colorBy: 'event' })).toBe('#2563eb');
    // Time mode interpolates the selected Event Date Colors gradient
    // (default Blue to Red): range endpoints land on the pure gradient ends.
    expect(colorForVisualEvent({ year: 1900 }, { colorBy: 'time' }, [1900, 2000])).toBe('#2563eb');
    expect(colorForVisualEvent({ year: 2000 }, { colorBy: 'time' }, [1900, 2000])).toBe('#dc2626');
    expect(colorForVisualEvent({ year: 2000 }, { colorBy: 'time', dateColorsMode: 'turquoise-red' }, [1900, 2000])).toBe('#dc2626');
    expect(colorForVisualEvent({}, { colorBy: 'uniform' })).toBe('#2563eb');
  });
});
