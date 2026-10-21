import ListDetail from '../../components/list/ListDetail'
import ListEditor from '../../components/list/ListEditor'
import ListImport from '../../components/list/ListImport'
import ListIndex from '../../components/list/ListIndex'
import type { useListsView } from '../../shared/hooks/useListsView'
import type { Confirmation } from '../../shared/hooks/useWorkspaceView'

export default function ListsScreen({ lists, confirm }: { lists: ReturnType<typeof useListsView>; confirm: (value: Confirmation) => void }) {
  const selected = lists.selected
  return (
    <>
      {selected ? <ListDetail lists={lists} onDelete={() => confirm({ title: `Delete “${selected.name}”?`, message: 'The list and all its items will be deleted on every device.', confirmLabel: 'Delete list', onConfirm: lists.deleteList })} />
        : <ListIndex summaries={lists.summaries} searching={lists.searching} onOpen={lists.open} onCreate={lists.startNew} />}
      {lists.error && !selected && !lists.editor && !lists.importing && <p className="form-error" role="alert">{lists.error}</p>}
      {lists.editor && <ListEditor key={lists.editor === 'new' ? 'new' : lists.editor.id} name={lists.editor === 'new' ? null : lists.editor.name} busy={lists.busy.has('name')} error={lists.error} onClose={lists.closeEditor} onSave={lists.saveName} />}
      {lists.importing && <ListImport text={lists.importText} count={lists.importCount} busy={!!selected && lists.busy.has(`add:${selected.id}`)} error={lists.error} onChange={lists.setImportText} onClose={lists.closeImport} onImport={lists.importItems} />}
    </>
  )
}
