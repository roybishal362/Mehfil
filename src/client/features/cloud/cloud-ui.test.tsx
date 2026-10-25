import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRuntimeConfig, type RuntimeConfig } from '../../app/runtime-config';
import { en } from '../../i18n/en';
import {
  connectCloud,
  disconnectCloudForTests,
  signInWithGoogle,
  syncNow,
} from '../../cloud/account';
import { setCloudBackendForTests } from '../../cloud/backend';
import { createShareLink, useShareLinks } from '../../cloud/shares';
import { useCloud } from '../../cloud/store';
import { SharedPlanPage } from '../../pages/SharedPlanPage';
import { plansStore } from '../../state/plans';
import { FakeCloud } from '../../test/fake-cloud';
import { renderAt, seedPlan } from '../../test/helpers';
import { AccountButton } from './AccountButton';
import { ConflictPrompt } from './ConflictPrompt';
import { ShareButton } from './ShareDialog';

const CONFIG: RuntimeConfig = {
  ai: { mode: 'gemini', requiresSignIn: false },
  firebase: {
    projectId: 'demo-mehfil',
    apiKey: 'public-web-key',
    authDomain: 'demo-mehfil.firebaseapp.com',
  },
  features: { cloudSync: true },
};

let cloud: FakeCloud;

beforeEach(() => {
  cloud = new FakeCloud();
  setCloudBackendForTests(cloud);
  useCloud.setState({ user: null, busy: null, conflictsDeferred: false });
  useShareLinks.setState({ links: {} });
});

afterEach(() => {
  disconnectCloudForTests();
  setCloudBackendForTests(null);
});

/** Opens the account dialog (the button's name also carries any sync warning). */
async function openAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${en.cloud.button}`) }));
  return screen.findByRole('dialog', { name: en.cloud.title });
}

describe('account dialog', () => {
  it('without cloud features, explains where plans live and can clear this device', async () => {
    const user = userEvent.setup();
    seedPlan();
    renderAt(<AccountButton />);
    const dialog = await openAccount(user);
    expect(dialog).toHaveTextContent(en.cloud.localOnly);
    expect(within(dialog).queryByRole('button', { name: en.cloud.signIn })).toBeNull();
    expect(await axe(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByRole('button', { name: en.cloud.deleteLocal }));
    const confirm = screen.getByRole('dialog', { name: en.cloud.deleteLocalTitle });
    await user.click(within(confirm).getByRole('button', { name: en.cloud.deleteLocalConfirm }));
    expect(plansStore.getState().order).toEqual([]);
  });

  it('signs in with Google, shows the sync state and signs out again', async () => {
    const user = userEvent.setup();
    useRuntimeConfig.setState({ config: CONFIG });
    connectCloud({ store: plansStore, storage: localStorage });
    const plan = seedPlan();
    renderAt(<AccountButton />);
    const dialog = await openAccount(user);
    expect(dialog).toHaveTextContent(en.cloud.pitch);
    await user.click(within(dialog).getByRole('button', { name: en.cloud.signIn }));
    expect(await within(dialog).findByText(en.cloud.signedInAs('Asha'))).toBeInTheDocument();
    await syncNow();
    expect(cloud.remoteRevision('uid-google', plan.id)).toBe(plan.revision);
    expect(within(dialog).getByRole('status')).toHaveTextContent(en.cloud.status.idle);
    expect(await axe(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByRole('button', { name: en.cloud.signOut }));
    expect(await within(dialog).findByRole('button', { name: en.cloud.signIn })).toBeEnabled();
    expect(screen.getByText(en.cloud.signedOut)).toBeInTheDocument();
  });

  it('explains a blocked popup and stays quiet when the user closes it', async () => {
    const user = userEvent.setup();
    useRuntimeConfig.setState({ config: CONFIG });
    connectCloud({ store: plansStore, storage: localStorage });
    const blocked = Object.assign(new Error('blocked'), { code: 'auth/popup-blocked' });
    const closed = Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' });
    vi.spyOn(cloud, 'signInWithGoogle')
      .mockRejectedValueOnce(blocked)
      .mockRejectedValueOnce(closed);
    renderAt(<AccountButton />);
    const dialog = await openAccount(user);
    await user.click(within(dialog).getByRole('button', { name: en.cloud.signIn }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(en.cloud.popupBlocked);
    await user.click(within(dialog).getByRole('button', { name: en.cloud.signIn }));
    await waitFor(() => {
      expect(within(dialog).queryByRole('alert')).toBeNull();
    });
  });

  it('deletes cloud data after confirmation', async () => {
    const user = userEvent.setup();
    useRuntimeConfig.setState({ config: CONFIG });
    connectCloud({ store: plansStore, storage: localStorage });
    const plan = seedPlan();
    await signInWithGoogle();
    await syncNow();
    renderAt(<AccountButton />);
    const dialog = await openAccount(user);
    await user.click(within(dialog).getByRole('button', { name: en.cloud.deleteCloud }));
    const confirm = screen.getByRole('dialog', { name: en.cloud.deleteCloudTitle });
    await user.click(within(confirm).getByRole('button', { name: en.cloud.deleteCloudConfirm }));
    await waitFor(() => {
      expect(cloud.deletedAccounts).toEqual(['uid-google']);
    });
    expect(cloud.remoteRevision('uid-google', plan.id)).toBeUndefined();
    expect(plansStore.getState().plans[plan.id]).toBeDefined();
  });
});

describe('conflicts', () => {
  it('asks which version to keep, and can wait until later', async () => {
    const user = userEvent.setup();
    useRuntimeConfig.setState({ config: CONFIG });
    connectCloud({ store: plansStore, storage: localStorage });
    const plan = seedPlan();
    await signInWithGoogle();
    await syncNow();
    cloud.putRemote('uid-google', { ...plan, revision: plan.revision + 4, summary: 'Phone' });
    plansStore.getState().transform(plan.id, (current) => ({ ...current, summary: 'Laptop' }));
    await syncNow();

    renderAt(
      <>
        <AccountButton />
        <ConflictPrompt />
      </>,
    );
    const prompt = await screen.findByRole('dialog', { name: en.cloud.conflictTitle });
    expect(prompt).toHaveTextContent(plan.brief.title);
    expect(await axe(prompt)).toHaveNoViolations();
    await user.click(within(prompt).getByRole('button', { name: en.cloud.decideLater }));
    expect(screen.queryByRole('dialog', { name: en.cloud.conflictTitle })).toBeNull();
    expect(
      screen.getByRole('button', { name: `${en.cloud.button}. ${en.cloud.conflictPending}` }),
    ).toBeInTheDocument();

    const account = await openAccount(user);
    await user.click(within(account).getByRole('button', { name: en.cloud.review }));
    const again = await screen.findByRole('dialog', { name: en.cloud.conflictTitle });
    await user.click(within(again).getByRole('button', { name: en.cloud.keepLocal }));
    await waitFor(() => {
      expect(JSON.parse(cloud.plans.get('uid-google')?.get(plan.id)?.json ?? '{}')).toMatchObject({
        summary: 'Laptop',
      });
    });
    expect(useCloud.getState().sync.conflicts).toEqual([]);
  });
});

describe('sharing', () => {
  it('is hidden when this server has no cloud features', () => {
    const plan = seedPlan();
    renderAt(<ShareButton plan={plan} />);
    expect(screen.queryByRole('button', { name: en.share.button })).toBeNull();
  });

  it('creates, copies, refreshes and stops a read-only link', async () => {
    const user = userEvent.setup();
    useRuntimeConfig.setState({ config: CONFIG });
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const plan = seedPlan();
    renderAt(<ShareButton plan={plan} />);
    await user.click(screen.getByRole('button', { name: en.share.button }));
    const dialog = screen.getByRole('dialog', { name: en.share.title });
    expect(dialog).toHaveTextContent(en.share.private);
    expect(await axe(dialog)).toHaveNoViolations();

    await user.click(within(dialog).getByRole('button', { name: en.share.create }));
    const link = await within(dialog).findByRole('textbox', { name: en.share.linkLabel });
    const id = Object.keys(Object.fromEntries(cloud.shares))[0] ?? '';
    expect(link).toHaveValue(`${window.location.origin}/s/${id}`);
    await user.click(within(dialog).getByRole('button', { name: en.share.copy }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/${id}`);

    await user.click(within(dialog).getByRole('checkbox', { name: en.share.includeBudget }));
    expect(dialog).toHaveTextContent(en.share.outdated);
    await user.click(within(dialog).getByRole('button', { name: en.share.update }));
    await waitFor(() => {
      expect(within(dialog).queryByText(en.share.outdated)).toBeNull();
    });
    expect(JSON.parse(cloud.shares.get(id)?.json ?? '{}')).not.toHaveProperty('budget');

    await user.click(within(dialog).getByRole('button', { name: en.share.stop }));
    expect(await within(dialog).findByRole('button', { name: en.share.create })).toBeEnabled();
    expect(cloud.shares.size).toBe(0);
  });

  it('reports a failure without losing the dialog', async () => {
    const user = userEvent.setup();
    useRuntimeConfig.setState({ config: CONFIG });
    cloud.offline = true;
    const plan = seedPlan();
    renderAt(<ShareButton plan={plan} />);
    await user.click(screen.getByRole('button', { name: en.share.button }));
    await user.click(screen.getByRole('button', { name: en.share.create }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.share.failed);
  });
});

describe('shared plan page', () => {
  it('shows the read-only plan from a link', async () => {
    const plan = seedPlan();
    const link = await createShareLink(plan, true);
    const { container } = renderAt(<SharedPlanPage params={{ id: link.id }} />, `/s/${link.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: plan.brief.title })).toBeVisible();
    // The shared copy wears its occasion's look, like the plan itself.
    expect(document.documentElement.dataset.mood).toBe('wedding');
    expect(screen.getByText(en.moods.greeting.wedding)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: en.shared.budgetTitle })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: en.shared.tasksTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.shared.makeYourOwn })).toHaveAttribute(
      'href',
      '/new',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('explains expired links and lets the reader retry after a network failure', async () => {
    const user = userEvent.setup();
    renderAt(<SharedPlanPage params={{ id: 'AAAAAAAAAAAAAAAAAAAAAA' }} />);
    expect(
      await screen.findByRole('heading', { name: en.shared.notFoundTitle }),
    ).toBeInTheDocument();

    cloud.offline = true;
    const { unmount } = renderAt(<SharedPlanPage params={{ id: 'BBBBBBBBBBBBBBBBBBBBBB' }} />);
    expect(await screen.findByRole('heading', { name: en.shared.errorTitle })).toBeInTheDocument();
    cloud.offline = false;
    await user.click(screen.getByRole('button', { name: en.common.retry }));
    expect(await screen.findAllByRole('heading', { name: en.shared.notFoundTitle })).toHaveLength(
      2,
    );
    unmount();
  });
});
