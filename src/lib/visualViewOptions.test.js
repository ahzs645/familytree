import { describe, expect, it } from 'vitest';
import {
  buildChronologicalConnections,
  colorForVisualEvent,
  connectionColorHex,
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

  it('applies a connection color preset to every segment', () => {
    const events = [
      { id: 'a', year: 1800, lat: 1, lng: 2, color: '#111111' },
      { id: 'b', year: 1900, lat: 3, lng: 4, color: '#222222' },
    ];
    const orange = buildChronologicalConnections(events, true, { connectionColor: 'orange' });
    expect(orange).toHaveLength(1);
    expect(orange[0].color).toBe(connectionColorHex('orange'));
    expect(connectionColorHex('orange')).toBe('#f97316');
  });

  it("keeps per-event colors when connection color is 'event-date'", () => {
    const events = [
      { id: 'a', year: 1800, lat: 1, lng: 2, color: '#111111' },
      { id: 'b', year: 1900, lat: 3, lng: 4, color: '#222222' },
    ];
    const [segment] = buildChronologicalConnections(events, true, { connectionColor: 'event-date' });
    // The segment inherits the destination event's marker color.
    expect(segment.color).toBe('#222222');
    expect(connectionColorHex('event-date')).toBeNull();
  });

  it('leaves connections uncolored without a color option (backward compatible)', () => {
    const [segment] = buildChronologicalConnections([
      { id: 'a', year: 1800, lat: 1, lng: 2 },
      { id: 'b', year: 1900, lat: 3, lng: 4 },
    ], true);
    expect(segment.color).toBeUndefined();
  });

  it('normalizes connectionColor and map type to known presets', () => {
    expect(normalizeVisualViewOptions('globe', { connectionColor: 'nope' }).connectionColor).toBe('white');
    expect(normalizeVisualViewOptions('globe', { connectionColor: 'turquoise' }).connectionColor).toBe('turquoise');
    expect(normalizeVisualViewOptions('globe', { mapType: 'hybrid' }).mapType).toBe('hybrid');
    expect(normalizeVisualViewOptions('globe', { mapType: 'bogus' }).mapType).toBe('standard');
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
