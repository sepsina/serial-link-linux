import { Component, OnInit, NgZone, OnDestroy, ApplicationRef } from '@angular/core';
import { SerialService } from '../serial.service';
import { EventsService } from '../events.service';
import { GlobalsService } from '../globals.service';
import { Validators, FormGroup, FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as gIF from '../gIF';

@Component({
    selector: 'app-actuator-010',
    templateUrl: './actuator-010.component.html',
    styleUrls: ['./actuator-010.component.scss'],
})
export class Actuator_010_Component implements OnInit, OnDestroy {

    minInt = 10;
    maxInt = 60;
    minLevel = 5;
    maxLevel = 95;
    state = false;

    repIntFormCtrl: FormControl;
    levelFormCtrl: FormControl;
    subscription = new Subscription();

    rwBuf = new gIF.rwBuf_t();

    constructor(private serial: SerialService,
                private events: EventsService,
                private globals: GlobalsService,
                private ngZone: NgZone,
                private appRef: ApplicationRef) {
        //---
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    ngOnInit(): void {

        this.events.subscribe('rdNodeDataRsp', (msg)=>{
            this.rwBuf.rdBuf = msg;
            this.rwBuf.rdIdx = 0;
            const partNum = this.rwBuf.read_uint32_LE();
            if(partNum == this.globals.ACTUATOR_010) {
                this.ngZone.run(()=>{
                    this.repIntFormCtrl.setValue(this.rwBuf.read_uint8());
                    this.state = !!this.rwBuf.read_uint8();
                    this.levelFormCtrl.setValue(this.rwBuf.read_uint8());
                });
            }
        });
        this.events.subscribe('rdNodeData_0', ()=>{
            this.rdNodeData_0();
        });

        this.repIntFormCtrl = new FormControl(
            this.minInt,
            [
                Validators.required,
                Validators.min(this.minInt),
                Validators.max(this.maxInt),
            ]
        );
        this.repIntFormCtrl.markAsTouched();
        const repIntSubscription = this.repIntFormCtrl.valueChanges.subscribe((newInt)=>{
            this.appRef.tick();
        });
        this.subscription.add(repIntSubscription);

        this.levelFormCtrl = new FormControl(
            this.minLevel,
            [
                Validators.required,
                Validators.min(this.minLevel),
                Validators.max(this.maxLevel),
            ]
        );
        this.levelFormCtrl.markAsTouched();
        const levelSubscription = this.levelFormCtrl.valueChanges.subscribe((level)=>{
            this.appRef.tick();
        });
        this.subscription.add(levelSubscription);
    }

    /***********************************************************************************************
     * fn          rdNodeData_0
     *
     * brief
     *
     */
    rdNodeData_0() {

        this.ngZone.run(()=>{
            this.state = !this.state;
            this.repIntFormCtrl.setValue(this.minInt);
            this.levelFormCtrl.setValue(this.minLevel);
        });

        setTimeout(()=>{
            this.serial.rdNodeData_0();
        }, 200);
    }

    /***********************************************************************************************
     * fn          wrNodeData_0
     *
     * brief
     *
     */
    wrNodeData_0() {

        let buf = new ArrayBuffer(7);
        let data = new DataView(buf);
        let idx = 0;

        data.setUint32(idx, this.globals.ACTUATOR_010, this.globals.LE);
        idx += 4;
        data.setUint8(idx++, this.repIntFormCtrl.value);
        data.setUint8(idx++, this.state ? 1 : 0);
        data.setUint8(idx++, this.levelFormCtrl.value);

        this.serial.wrNodeData_0(buf);
    }

    /***********************************************************************************************
     * fn          repIntErr
     *
     * brief
     *
     */
    repIntErr() {
        if(this.repIntFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        if(this.repIntFormCtrl.hasError('min')) {
            return `rep interval must be ${this.minInt} - ${this.maxInt}`;
        }
        if(this.repIntFormCtrl.hasError('max')) {
            return `rep interval must be ${this.minInt} - ${this.maxInt}`;
        }
    }

    /***********************************************************************************************
     * fn          levelErr
     *
     * brief
     *
     */
    levelErr() {
        if(this.levelFormCtrl.hasError('required')) {
            return 'You must enter a value';
        }
        if(this.levelFormCtrl.hasError('min')) {
            return `light level must be ${this.minLevel} - ${this.maxLevel}`;
        }
        if(this.levelFormCtrl.hasError('max')) {
            return `light level must be ${this.minLevel} - ${this.maxLevel}`;
        }
    }

    /***********************************************************************************************
     * fn          stateChange
     *
     * brief
     *
     */
     stateChange(state) {
        this.ngZone.run(()=>{
            this.state = state;
        });
    }

    /***********************************************************************************************
     * fn          isInvalid
     *
     * brief
     *
     */
    isInvalid() {
        if(this.levelFormCtrl.invalid){
            return true;
        }
        if(this.repIntFormCtrl.invalid){
            return true;
        }
        return false;
    }

}
