// Keeps the mobile sidebars clear of the on-screen keyboard. Obsidian's mobile app lets the
// keyboard slide over the web view, so a sidebar's bottom part (on phones: the view selector and
// the end of the search results) ends up underneath it. While the keyboard is up we pad the
// drawer's bottom by exactly the part the keyboard covers.

export class KeyboardInset {
	private cleanups: (() => void)[] = [];
	private keyboardHeight = 0;
	/** Window height with the keyboard down, to tell whether the web view shrank for the keyboard. */
	private restingInnerHeight = window.innerHeight;
	private frame = 0;

	constructor(private getDrawerEls: () => HTMLElement[]) {}

	start() {
		const onShow = (e: Event) => {
			const h = (e as Event & { keyboardHeight?: number }).keyboardHeight;
			this.keyboardHeight = typeof h === "number" ? h : this.cssKeyboardHeight();
			this.schedule();
		};
		const onHide = () => {
			this.keyboardHeight = 0;
			this.schedule();
		};
		const onViewport = () => {
			if (this.keyboardHeight === 0 && this.cssKeyboardHeight() === 0) this.restingInnerHeight = window.innerHeight;
			this.schedule();
		};
		const onFocus = () => window.setTimeout(() => this.schedule(), 350);

		window.addEventListener("keyboardWillShow", onShow);
		window.addEventListener("keyboardDidShow", onShow);
		window.addEventListener("keyboardWillHide", onHide);
		window.addEventListener("keyboardDidHide", onHide);
		window.addEventListener("resize", onViewport);
		window.visualViewport?.addEventListener("resize", onViewport);
		document.addEventListener("focusin", onFocus);
		document.addEventListener("focusout", onFocus);
		this.cleanups.push(() => {
			window.removeEventListener("keyboardWillShow", onShow);
			window.removeEventListener("keyboardDidShow", onShow);
			window.removeEventListener("keyboardWillHide", onHide);
			window.removeEventListener("keyboardDidHide", onHide);
			window.removeEventListener("resize", onViewport);
			window.visualViewport?.removeEventListener("resize", onViewport);
			document.removeEventListener("focusin", onFocus);
			document.removeEventListener("focusout", onFocus);
		});
	}

	stop() {
		this.cleanups.forEach((c) => c());
		this.cleanups = [];
		window.cancelAnimationFrame(this.frame);
		for (const drawer of this.getDrawerEls()) this.apply(drawer, 0);
	}

	private schedule() {
		window.cancelAnimationFrame(this.frame);
		this.frame = window.requestAnimationFrame(() => this.update());
	}

	private cssKeyboardHeight(): number {
		return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height")) || 0;
	}

	/** The y coordinate below which the keyboard hides things. */
	private visibleBottom(): number {
		const keyboard = Math.max(this.keyboardHeight, this.cssKeyboardHeight());
		const vv = window.visualViewport;
		let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
		if (keyboard > 0) {
			// If the web view already shrank by (most of) the keyboard, the keyboard covers nothing.
			const shrunk = this.restingInnerHeight - window.innerHeight;
			if (shrunk < keyboard / 2) bottom = Math.min(bottom, this.restingInnerHeight - keyboard);
		}
		return bottom;
	}

	private update() {
		const bottom = this.visibleBottom();
		for (const drawer of this.getDrawerEls()) {
			// Padding doesn't move the drawer's box, so measuring with our inset applied is fine.
			// Not isShown(): the drawer is position: fixed, so it never has an offsetParent.
			const rect = drawer.querySelector<HTMLElement>(".workspace-drawer-inner")?.getBoundingClientRect();
			const covered = rect && rect.width > 0 ? rect.bottom - bottom : 0;
			this.apply(drawer, covered > 1 ? Math.round(covered) : 0);
		}
	}

	private apply(drawer: HTMLElement, px: number) {
		drawer.toggleClass("osm-keyboard-open", px > 0);
		drawer.setCssProps({ "--osm-keyboard-inset": px > 0 ? `${px}px` : "" });
	}
}
