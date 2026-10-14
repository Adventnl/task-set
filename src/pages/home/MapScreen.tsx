import MapWorkspace from '../../components/map/MapWorkspace'
import PlaceEditor from '../../components/map/PlaceEditor'
import type { useMapView } from '../../shared/hooks/useMapView'
import type { Confirmation } from '../../shared/hooks/useWorkspaceView'

export default function MapScreen({ map, confirm }: { map: ReturnType<typeof useMapView>; confirm: (value: Confirmation) => void }) {
  return <>
    <MapWorkspace map={map} onDeleteCategory={(id) => confirm({ title: 'Delete this category?', message: 'Its saved pins are deleted too, on every device.', confirmLabel: 'Delete category', onConfirm: () => map.deleteCategory(id) })} />
    {map.place && <PlaceEditor key={map.editing?.id ?? `${map.place.latitude}:${map.place.longitude}`} place={map.place} pin={map.editing} categories={map.categories} onClose={map.closePlace} onSave={map.savePlace} onDelete={() => { const pin = map.editing; map.closePlace(); if (pin) confirm({ title: 'Delete this pin?', message: 'It is removed from your saved places on every device.', confirmLabel: 'Delete pin', onConfirm: () => map.deletePin(pin) }) }} />}
  </>
}
