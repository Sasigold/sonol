import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { stationSchema, type StationValues } from '@/lib/schemas';
import { positionAfter } from '@/lib/ordering';
import { formatCoordinates, parseWazeLink } from '@/lib/waze';
import { actions, fields, labels, stations as stationsCopy, validation } from '@/lib/copy';
import { cn } from '@/lib/utils';
import type { Area } from '@/hooks/useAreas';
import { useAreaStations, type Station } from '@/hooks/useStations';
import { useStationNumberTaken } from '@/hooks/useStationMutations';

interface StationFormProps {
  areas: Area[];
  /** Present in edit mode. EVERY field is seeded from this — see defect 11. */
  station?: Station | undefined;
  /** Area to preselect when adding, from the browsing context. Add mode only. */
  defaultAreaId?: string | undefined;
  pending: boolean;
  onSubmit: (values: StationValues) => void;
  onDelete?: (() => void) | undefined;
}

export function StationForm({
  areas,
  station,
  defaultAreaId,
  pending,
  onSubmit,
  onDelete,
}: StationFormProps) {
  const isEdit = station !== undefined;

  /**
   * Defect 11: editing a station silently moved it to a different area,
   * because the area field was seeded from the browsing context instead of
   * from the station itself.
   *
   * In edit mode EVERY default comes from `station` and nothing from
   * `defaultAreaId`. The context default applies only when adding.
   */
  const defaults: StationValues = useMemo(
    () =>
      station
        ? {
            name: station.name,
            sort_number: station.sort_number,
            area_id: station.area_id,
            fuel_type: station.fuel_type,
            total: station.total,
            flyers: station.flyers,
            waze_link: station.waze_link ?? '',
          }
        : {
            name: '',
            sort_number: 1,
            area_id: defaultAreaId ?? '',
            fuel_type: 'regular',
            total: 1,
            flyers: 0,
            waze_link: '',
          },
    [station, defaultAreaId],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isValid },
  } = useForm<StationValues>({
    resolver: zodResolver(stationSchema),
    defaultValues: defaults,
    mode: 'onChange',
  });

  // The station arrives after the first render (it is fetched), so the form
  // has to be re-seeded once it lands.
  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  // useWatch, not watch(): watch() returns a fresh function each render and
  // the React Compiler cannot memoize it, so it opts the component out of
  // memoization entirely.
  const wazeLink = useWatch({ control, name: 'waze_link' });
  const coordinates = useMemo(() => parseWazeLink(wazeLink), [wazeLink]);
  const linkInvalid = wazeLink.length > 0 && coordinates === null;

  /**
   * The (area, number) uniqueness check lives HERE rather than in the page.
   *
   * An earlier version reported the pair upward through an `onValuesChange`
   * callback so the page could run the query. The page passed a fresh arrow
   * each render, the effect depending on it fired every time, and the state it
   * set re-rendered the page — an infinite loop that typecheck, ESLint and the
   * unit tests all passed. Querying where the values already are removes the
   * round trip and the loop with it.
   */
  const watchedArea = useWatch({ control, name: 'area_id' });
  const watchedNumber = useWatch({ control, name: 'sort_number' });
  const { data: numberTaken = false } = useStationNumberTaken(
    watchedArea,
    watchedNumber,
    station?.id,
  );

  /**
   * The position helper.
   *
   * `sort_number` is `numeric(10,2)` precisely so a station can be slotted
   * between 12 and 13 as 12.5 — a design the form never exposed, leaving the
   * admin to work out the decimal themselves. Picking a neighbour computes it.
   *
   * The number field stays editable beside this: the helper is a shortcut, not
   * a replacement, and the (area, number) uniqueness check still guards both.
   */
  const { data: areaStations = [] } = useAreaStations(
    watchedArea.length > 0 ? watchedArea : undefined,
  );
  const siblings = useMemo(
    () => areaStations.filter((candidate) => candidate.id !== station?.id),
    [areaStations, station?.id],
  );

  /*
   * Transient: it drives no submitted value, it only writes into sort_number.
   *
   * The chosen area is stored ALONGSIDE the choice and the selection derived
   * from the pair, so switching area clears a neighbour that no longer exists
   * without an effect that calls setState — which cascades a render, and which
   * the lint rules reject outright.
   */
  const [position, setPosition] = useState({ areaId: '', value: '' });
  const positionValue = position.areaId === watchedArea ? position.value : '';

  function applyPosition(value: string) {
    setPosition({ areaId: watchedArea, value });
    const afterId = value === 'first' ? null : value.replace(/^after:/, '');
    setValue('sort_number', positionAfter(siblings, afterId), {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  const blocked = !isValid || linkInvalid || numberTaken;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <Field id="name" label={fields.stationName} error={errors.name?.message}>
        <Input id="name" autoComplete="off" {...register('name')} />
      </Field>

      <Field
        id="sort_number"
        label={fields.stationNumber}
        error={
          errors.sort_number?.message ?? (numberTaken ? validation.stationNumberTaken : undefined)
        }
      >
        <Input
          id="sort_number"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          dir="ltr"
          className="text-start"
          {...register('sort_number', { valueAsNumber: true })}
        />
      </Field>

      {/* Only worth showing once the area has something to sit between. */}
      {siblings.length > 0 ? (
        <Field id="position" label={fields.position}>
          <Select value={positionValue} onValueChange={applyPosition}>
            <SelectTrigger id="position">
              <SelectValue placeholder={fields.positionPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">{labels.positionFirst}</SelectItem>
              {siblings.map((sibling) => (
                <SelectItem key={sibling.id} value={`after:${sibling.id}`}>
                  {labels.positionAfter(sibling.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-caption text-text-muted">{stationsCopy.positionHint}</p>
        </Field>
      ) : null}

      <Field id="area_id" label={fields.area} error={errors.area_id?.message}>
        <Controller
          control={control}
          name="area_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="area_id" aria-invalid={errors.area_id ? true : undefined}>
                <SelectValue placeholder={fields.areaPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-strong text-text mb-2">{fields.fuelType}</legend>
        <Controller
          control={control}
          name="fuel_type"
          render={({ field }) => (
            <div className="bg-surface-alt flex gap-1 rounded-md p-1">
              {(['regular', 'super'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    field.onChange(type);
                  }}
                  aria-pressed={field.value === type}
                  className={cn(
                    'text-body-strong flex h-12 flex-1 items-center justify-center rounded-sm transition-colors',
                    field.value === type ? 'bg-surface text-text shadow-card' : 'text-text-muted',
                  )}
                >
                  {type === 'super' ? fields.fuelSuper : fields.fuelRegular}
                </button>
              ))}
            </div>
          )}
        />
      </fieldset>

      <Field id="total" label={fields.total} error={errors.total?.message}>
        <Controller
          control={control}
          name="total"
          render={({ field }) => (
            <QuantityStepper id="total" value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>

      <Field id="flyers" label={fields.flyers} error={errors.flyers?.message}>
        <Controller
          control={control}
          name="flyers"
          render={({ field }) => (
            <QuantityStepper id="flyers" value={field.value} onChange={field.onChange} />
          )}
        />
      </Field>

      <Field
        id="waze_link"
        label={fields.wazeLink}
        error={linkInvalid ? validation.cannotParseLocation : undefined}
      >
        <Input id="waze_link" dir="ltr" className="text-start" {...register('waze_link')} />
        {/* Show what will actually be stored, so the admin can see the link parsed. */}
        {coordinates ? (
          <p className="text-caption text-success flex items-center gap-1">
            <MapPin className="size-4" aria-hidden />
            <bdi className="ltr-isolate">{formatCoordinates(coordinates)}</bdi>
          </p>
        ) : null}
      </Field>

      {/*
        The submit button is ALWAYS visible and merely disabled — the original
        hid it with no explanation, leaving the admin with no idea why they
        could not save.
      */}
      <Button type="submit" size="wide" disabled={pending || blocked}>
        {pending ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-5" aria-hidden />
        )}
        {isEdit ? actions.update : actions.save}
      </Button>

      {onDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="wide"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="size-5" aria-hidden />
          {actions.deleteStation}
        </Button>
      ) : null}
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
