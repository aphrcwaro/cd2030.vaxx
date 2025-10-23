/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// AMD2ESM migration relevant

declare global {

	/**
	 * Holds the file root for resources.
	 */
	var _VAXX_FILE_ROOT: string;

	/**
	 * CSS loader that's available during development time.
	 * DO NOT call directly, instead just import css modules, like `import 'some.css'`
	 */
	var _VAXX_CSS_LOAD: (module: string) => void;
}

// fake export to make global work
export { }
