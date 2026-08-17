import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DirectionProvider } from '@radix-ui/react-direction';
import { describe, expect, it } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

/**
 * Radix resolves direction from React context, NOT from the document, and
 * falls back to `'ltr'` when no `DirectionProvider` is present. It then writes
 * that value out as a real `dir` attribute — on the Tabs root, on the Select
 * trigger, and on the portalled menu and listbox content. `dir="ltr"` on an
 * element beats the `dir="rtl"` on `<html>`, and portalled content is not even
 * a descendant of the app tree it would otherwise inherit from.
 *
 * So this is not theoretical: before the fix all three of these rendered
 * left-to-right inside an RTL app. These tests render with NO provider on
 * purpose — that is the state a unit test, and any portal, actually sees.
 */
describe('RTL is pinned on every direction-aware primitive', () => {
  it('stamps dir="rtl" on the dropdown menu content', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>פתיחת תפריט</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>סימון מעטפה</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await userEvent.click(screen.getByText('פתיחת תפריט'));

    expect(screen.getByRole('menu')).toHaveAttribute('dir', 'rtl');
  });

  it('stamps dir="rtl" on both the select trigger and its listbox', async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="בחירת אזור" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="north">צפון</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('dir', 'rtl');

    await userEvent.click(trigger);
    expect(screen.getByRole('listbox')).toHaveAttribute('dir', 'rtl');
  });

  it('stamps dir="rtl" on the tabs root, which wraps the whole station list', () => {
    const { container } = render(
      <Tabs defaultValue="notDone">
        <TabsList>
          <TabsTrigger value="notDone">לביצוע</TabsTrigger>
          <TabsTrigger value="done">הושלמו</TabsTrigger>
        </TabsList>
        <TabsContent value="notDone">תחנות</TabsContent>
      </Tabs>,
    );

    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl');
  });

  /**
   * There is no LTR mode. `dir` is omitted from each wrapper's props type, so
   * a call site cannot ask for one; this covers the other route in — an
   * ancestor provider — which the type system cannot see.
   */
  it('ignores an LTR DirectionProvider above it', () => {
    const { container } = render(
      <DirectionProvider dir="ltr">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">אחד</TabsTrigger>
          </TabsList>
          <TabsContent value="a">תוכן</TabsContent>
        </Tabs>
      </DirectionProvider>,
    );

    expect(container.firstElementChild).toHaveAttribute('dir', 'rtl');
  });
});
