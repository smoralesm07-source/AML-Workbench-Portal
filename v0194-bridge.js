'use strict';

/* Small bridge used by the v0.19.4 landing page so a UAF signal can open
 * the existing sector drawer after navigating to Inteligencia UAF.
 */
async function v0193OpenSector(name,uaf){
  const core=await v019LoadCore();
  v0193SectorDrawer(name,core,uaf);
}
