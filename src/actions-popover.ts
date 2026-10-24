// The drop-down behind the actions button. It borrows the view's own `.nav-buttons-container`
// (moved, not copied) so every button keeps Obsidian's click handlers, toggle states and the
// position of the menus it opens. When the drop-down closes the container goes back where it was.

import type { WorkspaceLeaf } from "obsidian";

export function navButtonsOf(leaf: WorkspaceLeaf | undefined): HTMLElement | null {
	const el = leaf?.view?.containerEl.querySelector<HTMLElement>(".nav-header .nav-buttons-container");
	return el && el.querySelector(".clickable-icon") ? el : null;
}

export class ActionsPopover {
	private popoverEl: HTMLElement | null = null;
	private anchorEl: HTMLElement | null = null;
	private borrowed: { el: HTMLElement; parent: Node; next: Node | null } | null = null;
	private cleanups: (() => void)[] = [];

	get isOpen() {
		return this.popoverEl !== null;
	}

	toggle(anchorEl: HTMLElement, leaf: WorkspaceLeaf | undefined) {
		const wasOpenHere = this.anchorEl === anchorEl;
		this.close();
		if (!wasOpenHere) this.open(anchorEl, leaf);
	}

	open(anchorEl: HTMLElement, leaf: WorkspaceLeaf | undefined) {
		const doc = anchorEl.doc;
		const popoverEl = doc.body.createDiv("osm-popover");
		this.popoverEl = popoverEl;
		this.anchorEl = anchorEl;
		anchorEl.addClass("has-active-menu");

		const buttons = navButtonsOf(leaf);
		if (buttons) {
			this.borrowed = { el: buttons, parent: buttons.parentNode!, next: buttons.nextSibling };
			buttons.addClass("osm-borrowed");
			popoverEl.appendChild(buttons);
		} else {
			popoverEl.createDiv({ cls: "osm-popover-empty", text: "This view has no actions" });
		}
		this.position();

		// A button press closes the drop-down once Obsidian has handled it. Buttons that open a
		// menu of their own (sort order) need their button to stay laid out, or Obsidian closes the
		// menu again; so the drop-down is only made invisible until that menu is gone.
		const onClick = (e: MouseEvent) => {
			if (!(e.target as HTMLElement).closest(".clickable-icon")) return;
			window.setTimeout(() => {
				if (!popoverEl.querySelector(".has-active-menu")) return this.close();
				popoverEl.addClass("is-parked");
				const watcher = new MutationObserver(() => {
					if (!popoverEl.querySelector(".has-active-menu")) this.close();
				});
				watcher.observe(popoverEl, { subtree: true, attributes: true, attributeFilter: ["class"] });
				this.cleanups.push(() => watcher.disconnect());
			}, 0);
		};
		const onOutside = (e: PointerEvent) => {
			const t = e.target as Node;
			if (popoverEl.hasClass("is-parked")) return;
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
		if (this.borrowed) {
			const { el, parent, next } = this.borrowed;
			el.removeClass("osm-borrowed");
			if (parent.isConnected) parent.insertBefore(el, next && next.parentNode === parent ? next : null);
			else el.remove();
			this.borrowed = null;
		}
		this.anchorEl?.removeClass("has-active-menu");
		this.anchorEl = null;
		this.popoverEl?.remove();
		this.popoverEl = null;
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
