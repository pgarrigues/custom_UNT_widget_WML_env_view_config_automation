import { React } from 'jimu-core'
import { MapWidgetSelector } from 'jimu-ui/advanced/setting-components'
import type { AllWidgetSettingProps } from 'jimu-for-builder'

export default function Setting(
  props: AllWidgetSettingProps<unknown>
): React.ReactElement {
  const onMapSelected = (useMapWidgetIds: string[]) => {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds: useMapWidgetIds
    })
  }

  return <div>
    <h4>Select a Map widget</h4>
    <MapWidgetSelector onSelect={onMapSelected} useMapWidgetIds={props.useMapWidgetIds} />
  </div>
}
