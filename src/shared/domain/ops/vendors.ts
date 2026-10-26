/** Vendor operations, including the quotes (options) collected for each vendor. */
import { LIMITS, type EventPlan, type Vendor } from '../../schemas/plan';
import {
  ensureRoom,
  findOrThrow,
  removeById,
  replaceById,
  type ApplyContext,
  type Op,
} from './core';

/** Applies a patch. `selectedOptionId: null` clears the choice; an id must name a known quote. */
function patchVendor(vendor: Vendor, patch: Op<'vendor.update'>['patch']): Vendor {
  const { selectedOptionId, ...rest } = patch;
  const next = { ...vendor, ...rest };
  if (selectedOptionId === undefined) return next;
  if (selectedOptionId === null) {
    const { selectedOptionId: _cleared, ...withoutSelection } = next;
    return withoutSelection;
  }
  findOrThrow(vendor.options, selectedOptionId, 'Vendor option');
  return { ...next, selectedOptionId };
}

export function updateVendor(plan: EventPlan, op: Op<'vendor.update'>): EventPlan {
  return {
    ...plan,
    vendors: replaceById(plan.vendors, op.id, 'Vendor', (vendor) => patchVendor(vendor, op.patch)),
  };
}

export function addVendor(plan: EventPlan, op: Op<'vendor.add'>, ctx: ApplyContext): EventPlan {
  ensureRoom(plan.vendors.length, 1, LIMITS.vendors, 'vendors');
  const vendor: Vendor = {
    id: ctx.makeId('vendor'),
    category: 'custom',
    label: op.vendor.label,
    priority: op.vendor.priority,
    bookBy: op.vendor.bookBy,
    status: 'not_started',
    questions: [],
    redFlags: [],
    options: [],
    source: ctx.source,
  };
  return { ...plan, vendors: [...plan.vendors, vendor] };
}

export function removeVendor(plan: EventPlan, op: Op<'vendor.remove'>): EventPlan {
  return { ...plan, vendors: removeById(plan.vendors, op.id, 'Vendor') };
}

export function addVendorOption(
  plan: EventPlan,
  op: Op<'vendor.addOption'>,
  ctx: ApplyContext,
): EventPlan {
  const vendors = replaceById(plan.vendors, op.vendorId, 'Vendor', (vendor) => {
    ensureRoom(vendor.options.length, 1, LIMITS.vendorOptions, 'options per vendor');
    return { ...vendor, options: [...vendor.options, { id: ctx.makeId('opt'), ...op.option }] };
  });
  return { ...plan, vendors };
}

export function updateVendorOption(plan: EventPlan, op: Op<'vendor.updateOption'>): EventPlan {
  const vendors = replaceById(plan.vendors, op.vendorId, 'Vendor', (vendor) => ({
    ...vendor,
    options: replaceById(vendor.options, op.optionId, 'Vendor option', (option) => ({
      ...option,
      ...op.patch,
    })),
  }));
  return { ...plan, vendors };
}

/** Removing the chosen quote also clears the choice. */
export function removeVendorOption(plan: EventPlan, op: Op<'vendor.removeOption'>): EventPlan {
  const vendors = replaceById(plan.vendors, op.vendorId, 'Vendor', (vendor) => {
    const options = removeById(vendor.options, op.optionId, 'Vendor option');
    if (vendor.selectedOptionId !== op.optionId) return { ...vendor, options };
    const { selectedOptionId: _cleared, ...rest } = vendor;
    return { ...rest, options };
  });
  return { ...plan, vendors };
}
