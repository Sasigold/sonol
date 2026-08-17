import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates } from '@/lib/waze';
import type { CapturedPosition } from '@/hooks/useGeolocationCapture';
import { location } from '@/lib/copy';

/**
 * A two-point map for one completion: the station's own coordinates and where
 * the worker's device was when they marked it done.
 *
 * Leaflet is driven imperatively (it owns its own DOM), and this module is the
 * lazy boundary — it is only imported when an admin opens the dialog, so Leaflet
 * and its CSS stay out of the worker's bundle. Markers are `circleMarker`s with
 * permanent tooltips rather than image pins, so there are no icon assets to ship
 * and the two points are told apart by their label, never by colour alone.
 *
 * Tiles come from OpenStreetMap at view time — the map needs a connection, which
 * an admin reviewing completions has. Offline it simply shows no tiles.
 */
export function StationMap({
  station,
  completion,
  isFar,
}: {
  station: Coordinates;
  completion: CapturedPosition | null;
  isFar: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;

    const map = L.map(el, { attributionControl: true });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const stationPoint: L.LatLngExpression = [station.latitude, station.longitude];
    const points: L.LatLng[] = [L.latLng(station.latitude, station.longitude)];

    L.circleMarker(stationPoint, {
      radius: 9,
      color: '#ffffff',
      weight: 2,
      fillColor: '#2563eb',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(location.mapStation, { permanent: true, direction: 'top' });

    if (completion !== null) {
      const completionPoint: L.LatLngExpression = [completion.latitude, completion.longitude];
      points.push(L.latLng(completion.latitude, completion.longitude));

      // Accuracy halo, so a wide fix does not read as a precise wrong spot.
      if (completion.accuracy > 0) {
        L.circle(completionPoint, {
          radius: completion.accuracy,
          color: isFar ? '#dc2626' : '#16a34a',
          weight: 1,
          fillOpacity: 0.1,
        }).addTo(map);
      }

      L.circleMarker(completionPoint, {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: isFar ? '#dc2626' : '#16a34a',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(location.mapCompletion, { permanent: true, direction: 'top' })
        .bindPopup(location.mapAccuracy(Math.round(completion.accuracy)));

      // A line between the two makes the gap legible at a glance.
      L.polyline([stationPoint, completionPoint], {
        color: isFar ? '#dc2626' : '#64748b',
        weight: 2,
        dashArray: '6 6',
      }).addTo(map);
    }

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 17 });
    } else {
      map.setView(stationPoint, 16);
    }

    // The dialog animates in, so the container may size after mount; recompute
    // once on the next frame or Leaflet renders grey tiles.
    const raf = requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
    };
  }, [station, completion, isFar]);

  return <div ref={containerRef} style={{ blockSize: 360 }} className="w-full rounded-md" />;
}
