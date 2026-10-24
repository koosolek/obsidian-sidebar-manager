// The drop-downs behind our tab-row buttons: the menu (view actions, vaults, settings) and the
// overflow list of views that don't fit the row.
//
// View actions are borrowed, not copied: the view's own `.nav-buttons-container` is moved into the
// drop-down so every button keeps Obsidian's click handlers, toggle states and the position of the
// menus it opens. When the drop-down closes it goes back where it was.

import { Platform, setIcon, WorkspaceLeaf } from "obsidian";

export function navButtonsOf(leaf: WorkspaceLeaf | undefined): HTMLElement | null {
	const el = leaf?.view?.containerEl.querySelector<HTMLElement>(".nav-header .nav-buttons-container");
	return el && el.querySelector(".clickable-icon") ? el : null;
}

export interface DropdownItem {
	icon: string;
	label: string;
	/** Shows a check mark, like Obsidian's menus do for the current choice. */
	checked?: boolean;
	/**
	 * The item opens an Obsidian menu of its own (shown with a chevron). `onClick` gets the item
	 * element to anchor that menu to; the drop-down stays until the menu closes.
	 */
	submenu?: boolean;
	onClick(itemEl: HTMLElement): void;
}

export interface DropdownContent {
	/** Starts a new section; a separator appears once both sections have something in them. */
	section(): void;
	item(item: DropdownItem): void;
	/** Moves a native element into the drop-down until it closes. */
	borrow(el: HTMLElement): void;
}

interface Borrowed {
	el: HTMLElement;
	parent: Node;
	next: Node | null;
}

export class Dropdown {
	private popoverEl: HTMLElement | null = null;
	private anchorEl: HTMLElement | null = null;
	private borrowed: Borrowed[] = [];
	private cleanups: (() => void)[] = [];

	get isOpen() {
		return this.popoverEl !== null;
	}

	toggle(anchorEl: HTMLElement, render: (content: DropdownContent) => void) {
		const wasOpenHere = this.anchorEl === anchorEl;
		this.close();
		if (!wasOpenHere) this.open(anchorEl, render);
	}

	open(anchorEl: HTMLElement, render: (content: DropdownContent) => void) {
		const doc = anchorEl.doc;
		const popoverEl = doc.body.createDiv("osm-popover");
		this.popoverEl = popoverEl;
		this.anchorEl = anchorEl;
		anchorEl.addClass("has-active-menu");

		let sectionEl: HTMLElement | null = null;
		const target = () => {
			if (!sectionEl) {
				if (popoverEl.querySelector(".osm-section")) popoverEl.createDiv("osm-separator");
				sectionEl = popoverEl.createDiv("osm-section");
			}
			return sectionEl;
		};
		render({
			section: () => {
				sectionEl = null;
			},
			item: (item) => this.renderItem(target(), item),
			borrow: (el) => {
				this.borrowed.push({ el, parent: el.parentNode!, next: el.nextSibling });
				el.addClass("osm-borrowed");
				target().appendChild(el);
			},
		});
		if (!popoverEl.hasChildNodes()) popoverEl.createDiv({ cls: "osm-popover-empty", text: "Nothing here" });
		this.position();

		// A borrowed button closes the drop-down once Obsidian has handled the press. Buttons that
		// open a menu of their own (sort order) need to stay laid out, or Obsidian closes that menu
		// again; so the drop-down is only made invisible until that menu is gone.
		const onClick = (e: MouseEvent) => {
			if (!(e.target as HTMLElement).closest(".osm-borrowed .clickable-icon")) return;
			window.setTimeout(() => {
				if (popoverEl.querySelector(".has-active-menu")) this.holdWhileMenuOpen(true);
				else this.close();
			}, 0);
		};
		const onOutside = (e: PointerEvent) => {
			const t = e.target as HTMLElement;
			// Presses in a menu opened from the drop-down belong to that menu.
			if (popoverEl.hasClass("is-parked") || t.closest?.(".menu")) return;
			if (!popoverEl.contains(t) && !anchorEl.contains(t)) this.close();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") this.close();
		};
		const onResize = () => this.position();
		popoverEl.addEventListener("click", onClick);
		doc.addEventListener("pointerdown", onOutside, true);
		doc.addEventListener("keydown", onKey, true);
		window.addEventListener("resize", onResize);
		this.cleanups.push(() => {
			doc.removeEventListener("pointerdown", onOutside, true);
			doc.removeEventListener("keydown", onKey, true);
			window.removeEventListener("resize", onResize);
		});
	}

	close() {
		this.cleanups.forEach((c) => c());
		this.cleanups = [];
		for (const { el, parent, next } of this.borrowed) {
			el.removeClass("osm-borrowed");
			if (parent.isConnected) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
			else el.remove();
		}
		this.borrowed = [];
		this.anchorEl?.removeClass("has-active-menu");
		this.anchorEl = null;
		this.popoverEl?.remove();
		this.popoverEl = null;
	}

	/**
	 * Keeps the drop-down until the menu opened from it closes. On phones that menu is a sheet over
	 * the whole screen, so the drop-down hides meanwhile (it stays laid out: Obsidian closes a menu
	 * whose button is hidden). Elsewhere it stays visible, with the menu beside it like a submenu.
	 */
	private holdWhileMenuOpen(park: boolean) {
		const popoverEl = this.popoverEl;
		if (!popoverEl) return;
		popoverEl.toggleClass("is-parked", park);
		const watcher = new MutationObserver(() => {
			if (!popoverEl.querySelector(".has-active-menu")) this.close();
		});
		watcher.observe(popoverEl, { subtree: true, attributes: true, attributeFilter: ["class"] });
		this.cleanups.push(() => watcher.disconnect());
	}

	private renderItem(parent: HTMLElement, item: DropdownItem) {
		const el = parent.createDiv("osm-menu-item");
		setIcon(el.createDiv("osm-menu-item-icon"), item.icon);
		el.createDiv({ cls: "osm-menu-item-title", text: item.label });
		if (item.submenu) setIcon(el.createDiv("osm-menu-item-chevron"), "lucide-chevron-right");
		else if (item.checked) setIcon(el.createDiv("osm-menu-item-check"), "lucide-check");
		el.addEventListener("click", (e) => {
			e.preventDefault();
			if (!item.submenu) {
				this.close();
				return item.onClick(el);
			}
			if (el.hasClass("has-active-menu")) return;
			item.onClick(el);
			if (el.hasClass("has-active-menu")) this.holdWhileMenuOpen(Platform.isPhone);
		});
	}

	/** Under the button, or above it when there's more room there; kept inside the window. */
	private position() {
		const { popoverEl, anchorEl } = this;
		if (!popoverEl || !anchorEl) return;
		const a = anchorEl.getBoundingClientRect();
		const vv = window.visualViewport;
		const viewTop = vv ? vv.offsetTop : 0;
		const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
		const margin = 8;
		const width = popoverEl.offsetWidth;
		const height = popoverEl.offsetHeight;
		const below = viewBottom - a.bottom;
		const above = a.top - viewTop;
		const top = below >= height + margin || below >= above ? a.bottom + 4 : a.top - 4 - height;
		const left = Math.min(Math.max(margin, a.right - width), window.innerWidth - width - margin);
		popoverEl.style.top = `${Math.max(viewTop + margin, top)}px`;
		popoverEl.style.left = `${left}px`;
		popoverEl.style.maxHeight = `${Math.max(120, (top > a.top ? viewBottom - a.bottom : above) - margin * 2)}px`;
	}
}
