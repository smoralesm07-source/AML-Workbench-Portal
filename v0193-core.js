'use strict';

/* v0.19.3 core isolation: replace the generic regional priority set with a
   security-invoker view that excludes every finding carrying RADAR_UAF as a
   producer. UAF-specific territorial analysis remains available in
   Intelligence UAF through gaps/uafRegions. */

const v0193CoreBase=v019LoadCore;
v019LoadCore=async function(force=false){
  const core=await v0193CoreBase(force);
  try{
    const {data,error}=await sb.from('aml_v0193_region_priority_non_uaf').select('*').order('attention_index',{ascending:false,nullsFirst:false});
    if(error)throw error;
    core.regions=data||[];
    core.region_priority_scope='NON_UAF';
  }catch(error){
    core.region_priority_scope='LEGACY_FALLBACK';
    core.region_priority_warning=error?.message||String(error);
  }
  return core;
};
