// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OnboardingGate } from './OnboardingGate';
const route = vi.hoisted(() => ({ path: '/app/astrology' }));
vi.mock('wouter', () => ({ useLocation: () => [route.path, vi.fn()], Link: ({children}: {children:ReactNode}) => <>{children}</> }));
vi.mock('../../lib/auth', () => ({useLocalAccount: () => null, saveLocalAccount: vi.fn()}));
vi.mock('../../lib/useProfile', () => ({useProfile: () => ({anonId:'isolated',profile:null,saveProfile:vi.fn()})}));
vi.mock('../../lib/i18n', () => ({useLanguage: () => ({t:(key:string) => key,language:'en'})}));
vi.mock('../../lib/LocalizedText', () => ({LocalizedText: ({text}:{text:string}) => <>{text}</>}));
vi.mock('./LocalProfileSwitcher', () => ({LocalProfileSwitcher: () => null}));
beforeEach(() => {localStorage.clear();window.history.replaceState({},'', '/app/astrology');});
afterEach(cleanup);
it.each(['/app/astrology','/app/compatibility','/app/compatibility/invite/fictional'])('lets a completely new device enter %s without email onboarding', path => {
 route.path=path;render(<OnboardingGate><p>Astrology journey</p></OnboardingGate>);
 expect(screen.queryByTestId('onboarding-flow')).toBeNull();expect(screen.getByText('Astrology journey')).toBeTruthy();
 expect(localStorage.getItem('hint_onboarding_complete_v3')).toBeNull();
});
it('retains onboarding elsewhere and respects an explicit reset', () => {
 route.path='/app';const view=render(<OnboardingGate><p>Application</p></OnboardingGate>);expect(screen.getByTestId('onboarding-flow')).toBeTruthy();view.unmount();
 route.path='/app/astrology';window.history.replaceState({},'', '/app/astrology?onboarding=reset');render(<OnboardingGate><p>Astrology</p></OnboardingGate>);expect(screen.getByTestId('onboarding-flow')).toBeTruthy();
});
