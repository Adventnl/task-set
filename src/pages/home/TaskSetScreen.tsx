import TaskSetWorkspace from '../../components/task/TaskSetWorkspace'
import { useTaskSet } from '../../shared/hooks/useTaskSet'

export default function TaskSetScreen() {
  const model = useTaskSet()
  return <TaskSetWorkspace model={model} />
}
